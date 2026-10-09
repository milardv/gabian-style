import {pwaAssets,renderWorker} from './lib/pwa-assets.js';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marseilleBoundary, marseilleOverview, marseilleOverviewImagery, marseilleTerrain, marseilleBuildings, marseilleRoads, marseilleImagery, validCityTile } from './lib/marseille-data.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const publicDir = join(root, 'public');
const pwa = pwaAssets(publicDir);
const worker = renderWorker(readFileSync(join(publicDir,'sw.js'),'utf8'),pwa);
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '127.0.0.1';
const userAgent = 'GabianStyle/0.1 (local Marseille game)';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb':'model/gltf-binary', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8' };

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}
function fail(response, status, message) { json(response, status, { error: message }); }

async function getJson(url, timeoutMs = 12000) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    if (response.status === 429) throw new Error('Source temporairement limitée. Réessayez dans quelques instants.');
    const error = new Error(`Source indisponible (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const coastalRoute=[[5.3743,43.29515],[5.36016,43.27496],[5.36691,43.24206],[5.36296,43.23698],[5.35885,43.23245],[5.3543,43.21293]];
const fallbackMissions=[
  {address:'1 Quai des Belges, 13001 Marseille',coordinates:[5.374641,43.295134]},
  {address:'178 Corniche Président John F. Kennedy, 13007 Marseille',coordinates:[5.360155,43.274963]},
  {address:'4 Promenade du Grand Large, 13008 Marseille',coordinates:[5.366906,43.242063]},
  {address:'48 Avenue de la Madrague de Montredon, 13008 Marseille',coordinates:[5.362964,43.236976]},
  {address:'8 Traverse de la Marbrerie, 13008 Marseille',coordinates:[5.358849,43.232453]},
  {address:'5 Avenue des Pébrons, 13008 Marseille',coordinates:[5.354304,43.212929]}
];
function pointAlongCoast(progress){const legs=[];let total=0;for(let i=1;i<coastalRoute.length;i++){const a=coastalRoute[i-1],b=coastalRoute[i],length=Math.hypot((b[0]-a[0])*Math.cos(43.25*Math.PI/180),b[1]-a[1]);legs.push({a,b,length,start:total});total+=length;}const target=progress*total,leg=legs.find(x=>target<=x.start+x.length)||legs.at(-1),t=Math.max(0,Math.min(1,(target-leg.start)/leg.length));return[leg.a[0]+(leg.b[0]-leg.a[0])*t,leg.a[1]+(leg.b[1]-leg.a[1])*t];}
async function randomCoastalMission(){for(let attempt=0;attempt<4;attempt++){const progress=.12+Math.random()*.84,[lon,lat]=pointAlongCoast(progress),url=new URL('https://data.geopf.fr/geocodage/reverse');url.search=new URLSearchParams({lon:lon.toFixed(6),lat:lat.toFixed(6),index:'address',limit:'10'});try{const data=await getJson(url,12000),feature=data.features?.find(f=>f.properties?.type==='housenumber'&&f.properties?.citycode==='13201');if(feature){const [x,y]=feature.geometry.coordinates;if(x>=5.345&&x<=5.385&&y>=43.205&&y<=43.3)return{address:feature.properties.label,coordinates:[x,y],progress,source:'Base Adresse Nationale / Géoplateforme IGN'};}}catch{break;}}
 const fallback=fallbackMissions[Math.floor(Math.random()*fallbackMissions.length)];return{...fallback,progress:null,source:'Base Adresse Nationale / Géoplateforme IGN'};}

createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') return fail(response, 405, 'Méthode non autorisée.');
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if(url.pathname==='/sw.js'){response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return response.end(worker);}
    if (url.pathname === '/healthz') return json(response, 200, { status: 'ok' });
    if (url.pathname === '/api/marseille/boundary') return json(response, 200, await marseilleBoundary());
    if (url.pathname === '/api/marseille/overview') return json(response, 200, await marseilleOverview());
    if (url.pathname === '/api/marseille/mission') return json(response, 200, await randomCoastalMission());
    if (url.pathname === '/api/marseille/overview-imagery') {
      const image = await marseilleOverviewImagery();
      response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=2592000' });
      return response.end(image);
    }
    const cityTile = url.pathname.match(/^\/api\/marseille\/(terrain|buildings|roads|imagery)\/(\d{1,5})\/(\d{1,5})$/);
    if (cityTile) {
      const x = Number(cityTile[2]), y = Number(cityTile[3]);
      if (!validCityTile(x, y)) return fail(response, 400, 'Tuile hors de Marseille.');
      if (cityTile[1] === 'terrain') return json(response, 200, await marseilleTerrain(x, y));
      if (cityTile[1] === 'buildings') return json(response, 200, await marseilleBuildings(x, y));
      if (cityTile[1] === 'roads') return json(response, 200, await marseilleRoads(x,y));
      const requestedSize = Number(url.searchParams.get('size'));
      const image = await marseilleImagery(x, y, requestedSize === 2048 ? 2048 : 1024);
      response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
      return response.end(image);
    }
    if(url.searchParams.has('build')&&url.searchParams.get('build')!==pwa.version)return fail(response,409,'Version remplacée ; réessayez.');
    const target = ['/', '/marseille', '/marseille/'].includes(url.pathname) ? '/index.html' : url.pathname;
    const path = normalize(join(publicDir, target));
    if (!path.startsWith(publicDir + '/') || !existsSync(path)) return fail(response, 404, 'Page introuvable.');
    const compressed=/\bgzip\b(?!\s*;\s*q=0(?:\D|$))/i.test(request.headers['accept-encoding']||'')&&existsSync(path+'.gz');
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'X-Gabian-Version':pwa.version, 'Vary':'Accept-Encoding', ...(compressed?{'Content-Encoding':'gzip'}:{}), 'Cache-Control': ['.html','.js','.css','.webmanifest'].includes(extname(path)) ? 'no-cache' : 'public, max-age=86400' });
    response.end(readFileSync(path+(compressed?'.gz':'')));
  } catch (error) {
    console.error(error);
    if (response.headersSent) response.destroy(error);
    else fail(response, 502, error.message || 'Une source externe ne répond pas.');
  }
}).listen(port, host, () => console.log(`Gabian Style : http://${host}:${port}`));
