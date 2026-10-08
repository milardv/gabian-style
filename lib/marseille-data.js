import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inPolygons, localBounds, toLocal, toGeo, tileBounds } from '../public/flight/geo.js';

const dir = fileURLToPath(new URL('../.data/marseille/', import.meta.url));
const ongoing = new Map();
const TTL = 30 * 24 * 60 * 60 * 1000;
const BOUNDS = [5.20, 43.16, 5.57, 43.43];
async function cached(name, loader, binary = false) {
  if (ongoing.has(name)) return ongoing.get(name);
  const promise = (async () => {
    await mkdir(dir, { recursive: true });
    const path = dir + name;
    try {
      const raw = await readFile(path);
      if (binary) return raw;
      const data = JSON.parse(raw);
      if (Date.now() - Date.parse(data.cached_at) < TTL) return data;
    } catch { /* download or refresh this tile */ }
    const value = await loader();
    const data = binary ? value : { ...value, cached_at: new Date().toISOString() };
    const temp = path + '.part';
    await writeFile(temp, binary ? data : JSON.stringify(data));
    await rename(temp, path);
    return data;
  })();
  ongoing.set(name, promise);
  try { return await promise; } finally { ongoing.delete(name); }
}
async function json(url) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'GabianStyle/1.0', Accept: 'application/json' } });
    if (response.ok) return response.json();
    if (attempt >= 3 || ![429, 502, 503, 504].includes(response.status)) throw new Error(`Source cartographique indisponible (${response.status}).`);
    await new Promise(resolve => setTimeout(resolve, 800 * 2 ** attempt));
  }
}
export function validCityTile(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  const b = tileBounds(x, y);
  return b[0] <= BOUNDS[2] && b[2] >= BOUNDS[0] && b[1] <= BOUNDS[3] && b[3] >= BOUNDS[1];
}
export function marseilleBoundary() {
  return cached('boundary.json', async () => {
    const feature = await json('https://geo.api.gouv.fr/communes/13055?format=geojson&geometry=contour');
    if (feature.properties?.code !== '13055' || !feature.geometry?.coordinates) throw new Error('Contour de Marseille invalide.');
    const coordinates = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
    return { polygons: coordinates.map(rings => rings.map(ring => ring.map(point => toLocal(...point)))), bounds: localBounds(BOUNDS), source: 'API Géo / IGN ADMIN EXPRESS', commune: '13055' };
  });
}
async function elevationGrid(bounds, size) {
  const [west, north, east, south] = bounds;
  const points = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) points.push(toGeo(west + (east - west) * x / (size - 1), north + (south - north) * y / (size - 1)));
  const heights = new Array(points.length);
  for (let start = 0; start < points.length; start += 250) {
    const batch = points.slice(start, start + 250);
    const url = new URL('https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json');
    url.search = new URLSearchParams({ resource: 'ign_rge_alti_wld', zonly: 'true', lon: batch.map(p => p[0].toFixed(5)).join('|'), lat: batch.map(p => p[1].toFixed(5)).join('|') });
    const data = await json(url);
    if (data.elevations?.length !== batch.length) throw new Error('Grille altimétrique IGN incomplète.');
    data.elevations.forEach((height, index) => { heights[start + index] = height > -1000 ? Math.max(0, height) : 0; });
    if (start + 250 < points.length) await new Promise(resolve => setTimeout(resolve, 120));
  }
  return { bounds, size, heights, source: 'IGN RGE ALTI', no_data_height: 0 };
}
export function marseilleOverview() { return cached('overview.json', () => elevationGrid(localBounds(BOUNDS), 65)); }
export function marseilleTerrain(x, y) { return cached(`terrain-v3-${x}-${y}.json`, () => elevationGrid(localBounds(tileBounds(x, y)), 81)); }
export function marseilleBuildings(x, y) {
  return cached(`buildings-v4-toponyms-${x}-${y}.json`, async () => {
    const url = new URL('https://data.geopf.fr/wfs/ows');
    url.search = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'BDTOPO_V3:batiment', outputFormat: 'application/json', srsName: 'EPSG:4326', bbox: [...tileBounds(x, y), 'EPSG:4326'].join(','), count: '5000', propertyName: 'cleabs,geometrie,hauteur,nombre_d_etages,altitude_minimale_sol,altitude_minimale_toit,altitude_maximale_toit,nature,usage_1,etat_de_l_objet' });
    const [data, boundary] = await Promise.all([json(url), marseilleBoundary()]);
    if (!Array.isArray(data.features)) throw new Error('Bâtiments IGN illisibles.');
    let offset = data.features.length;
    while (offset < Number(data.numberMatched)) {
      url.searchParams.set('startIndex', String(offset));
      const page = await json(url);
      if (!page.features?.length) throw new Error('Tuile de bâtiments incomplète.');
      data.features.push(...page.features); offset = data.features.length;
    }
    const buildings = [];
    for (const feature of data.features) {
      if (feature.properties.etat_de_l_objet && feature.properties.etat_de_l_objet !== 'En service') continue;
      const polygons = feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates : feature.geometry?.type === 'Polygon' ? [feature.geometry.coordinates] : [];
      for (const rings of polygons) {
        const points = rings.map(ring => ring.map(point => toLocal(...point)));
        const ring = points[0];
        const center = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
        if (!inPolygons(...center, boundary.polygons)) continue;
        // Assign a crossing building to its centroid tile to avoid duplicate geometry.
        const b = localBounds(tileBounds(x, y));
        if (center[0] < b[0] || center[0] >= b[2] || center[1] < b[1] || center[1] >= b[3]) continue;
        const p = feature.properties;
        const measured = Number(p.hauteur) > 0;
        const height = measured ? Number(p.hauteur) : Math.max(3, (Number(p.nombre_d_etages) || 2) * 3);
        const base = p.altitude_minimale_sol != null ? Number(p.altitude_minimale_sol) : null;
        const roof = p.altitude_minimale_toit != null ? Number(p.altitude_minimale_toit) : base == null ? null : base + height;
        buildings.push({ id: p.cleabs || feature.id, rings: points, center, base, roof, height, measured, nature: p.nature, usage: p.usage_1 });
      }
    }
    const names = new URL('https://data.geopf.fr/wfs/ows');
    names.search = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'BDTOPO_V3:toponymie', outputFormat: 'application/json', srsName: 'EPSG:4326', bbox: [...tileBounds(x, y), 'EPSG:4326'].join(','), count: '5000', propertyName: 'classe_de_l_objet,nature_de_l_objet,nature_detaillee_de_l_objet,graphie_du_toponyme,cleabs_de_l_objet,geometrie' });
    const toponyms = await json(names);
    if (!Array.isArray(toponyms.features)) throw new Error('Toponymes IGN illisibles.');
    const landmarkKinds = /mairie|culte|musée|salle de spectacle|vestige archéologique|monument|historique|opéra|cathédrale|basilique|palais|stade|phare|fort|pont|hôpital|universit|bibliothèque|parc\b|jardin|gare|station de métro|fontaine|château|préfecture|tribunal/i;
    const landmarks = toponyms.features.flatMap(feature => {
      const p = feature.properties, coords = feature.geometry?.coordinates, label = String(p.graphie_du_toponyme || '').trim();
      if (!coords || !label || !landmarkKinds.test(`${p.nature_de_l_objet || ''} ${p.nature_detaillee_de_l_objet || ''}`)) return [];
      const center = toLocal(coords[0], coords[1]), tileBoundsLocal = localBounds(tileBounds(x, y));
      if (!inPolygons(...center, boundary.polygons) || center[0] < tileBoundsLocal[0] || center[0] >= tileBoundsLocal[2] || center[1] < tileBoundsLocal[1] || center[1] >= tileBoundsLocal[3]) return [];
      const building = buildings.find(item => item.id === p.cleabs_de_l_objet);
      return [{ id: p.cleabs_de_l_objet || feature.id, name: label, kind: p.nature_de_l_objet || p.classe_de_l_objet, center, height: building ? building.roof ?? building.base + building.height : null }];
    });
    const points = new URL('https://data.geopf.fr/wfs/ows');
    points.search = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'BDTOPO_V3:construction_ponctuelle', outputFormat: 'application/json', srsName: 'EPSG:4326', bbox: [...tileBounds(x, y), 'EPSG:4326'].join(','), count: '5000', propertyName: 'cleabs,nature,hauteur,geometrie' });
    const constructions = await json(points);
    if (!Array.isArray(constructions.features)) throw new Error('Constructions remarquables IGN illisibles.');
    const structures = constructions.features.flatMap(feature => {
      const p = feature.properties, coords = feature.geometry?.coordinates;
      if (!coords || !['Clocher', 'Minaret', 'Phare', 'Antenne', 'Cheminée', 'Eolienne', 'Autre construction élevée'].includes(p.nature) || coords[2] <= -100) return [];
      const center = toLocal(coords[0], coords[1]);
      if (!inPolygons(...center, boundary.polygons)) return [];
      const b = localBounds(tileBounds(x, y));
      if (center[0] < b[0] || center[0] >= b[2] || center[1] < b[1] || center[1] >= b[3]) return [];
      return [{ id: p.cleabs || feature.id, center, top: coords[2], nature: p.nature }];
    });
    return { buildings, structures, landmarks, source: 'IGN BD TOPO V3', measured: buildings.filter(b => b.measured).length };
  });
}
export function marseilleRoads(x,y){return cached(`roads-v2-${x}-${y}.json`,async()=>{
  const url=new URL('https://data.geopf.fr/wfs/ows');url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'BDTOPO_V3:troncon_de_route',outputFormat:'application/json',srsName:'EPSG:4326',bbox:[...tileBounds(x,y),'EPSG:4326'].join(','),count:'5000',propertyName:'geometrie,cleabs,nature,largeur_de_chaussee,nom_collaboratif_gauche,nom_collaboratif_droite,nom_voie_ban_gauche,nom_voie_ban_droite,etat_de_l_objet,prive,acces_vehicule_leger'});
  const data=await json(url);if(!Array.isArray(data.features))throw new Error('Réseau routier IGN illisible.');let offset=data.features.length;
  while(offset<Number(data.numberMatched)){url.searchParams.set('startIndex',String(offset));const page=await json(url);if(!page.features?.length)throw new Error('Réseau routier IGN incomplet.');data.features.push(...page.features);offset=data.features.length;}
  const roads=[];for(const feature of data.features){const p=feature.properties,g=feature.geometry;if(p.etat_de_l_objet&&p.etat_de_l_objet!=='En service'||p.prive===true||p.acces_vehicule_leger==='Interdit'||['Escalier','Sentier','Piste cyclable','Chemin'].includes(p.nature))continue;const lines=g?.type==='MultiLineString'?g.coordinates:g?.type==='LineString'?[g.coordinates]:[];for(const line of lines){if(line.length<2)continue;const points=line.map(c=>{const [px,pz]=toLocal(c[0],c[1]);return[px,Number.isFinite(c[2])&&c[2]>-100?c[2]:null,pz];});roads.push({id:p.cleabs||feature.id,name:p.nom_voie_ban_gauche||p.nom_voie_ban_droite||p.nom_collaboratif_gauche||p.nom_collaboratif_droite||'',nature:p.nature||'',width:Math.max(3,Math.min(12,Number(p.largeur_de_chaussee)||4.5)),points});}}
  return{roads,source:'IGN BD TOPO V3'};
});}
export function marseilleImagery(x, y, size = 1024) {
  const resolution = size === 2048 ? 2048 : 1024;
  return marseilleOrthophoto(tileBounds(x, y), resolution, `ortho-v3-${resolution}-${x}-${y}.jpg`);
}
export function marseilleOverviewImagery() {
  return marseilleOrthophoto(BOUNDS, 3072, 'ortho-overview-v1-3072.jpg');
}
export function marseilleOrthophoto(bounds, size, cacheName) {
  return cached(cacheName, async () => {
    const [west, south, east, north] = bounds;
    const merc = (lon, lat) => [6378137 * lon * Math.PI / 180, 6378137 * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
    const bbox = [...merc(west, south), ...merc(east, north)];
    const url = new URL('https://data.geopf.fr/wms-r');
    url.search = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: 'ORTHOIMAGERY.ORTHOPHOTOS', STYLES: '', CRS: 'EPSG:3857', BBOX: bbox.join(','), WIDTH: String(size), HEIGHT: String(size), FORMAT: 'image/jpeg' });
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Orthophoto IGN indisponible.');
    return Buffer.from(await response.arrayBuffer());
  }, true);
}
