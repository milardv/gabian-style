import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fromArrayBuffer} from 'geotiff';
import sharp from 'sharp';
import {tileBounds,localBounds,sampleGrid,inPolygons} from '../public/flight/geo.js';
import {marseilleOrthophoto,marseilleOverview,marseilleBoundary} from '../lib/marseille-data.js';
import {tileBox,Z_UP_TO_GAME} from '../lib/terrain-tiles.js';
import {splitTerrainGrid} from '../lib/coast-grid.js';
import {gzipSync,gunzipSync} from 'node:zlib';
import {COAST_KEYS,COAST_DIR} from '../public/flight/coast-config.js';

const dir=new URL(`../public${COAST_DIR}`,import.meta.url),size=513;
const tiles=[...COAST_KEYS].map(key=>key.split('/').map(Number)),children=[],summaries=[];
await mkdir(dir,{recursive:true});
async function raster(bounds,kind){
 const [w,s,e,n]=bounds,R=6378137,merc=(lon,lat)=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
 const [west,south]=merc(w,s),[east,north]=merc(e,n),dx=(east-west)/(size-1),dy=(north-south)/(size-1);
 const url=new URL('https://data.geopf.fr/wms-r');url.search=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:`IGNF_LIDAR-HD_${kind}_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93`,STYLES:'',CRS:'EPSG:3857',BBOX:[west-dx/2,south-dy/2,east+dx/2,north+dy/2].join(','),WIDTH:String(size),HEIGHT:String(size),FORMAT:'image/geotiff'});
 const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok||!r.headers.get('content-type')?.includes('geotiff'))throw Error(`${kind}: ${r.status}`);
 return (await(await(await fromArrayBuffer(await r.arrayBuffer())).getImage()).readRasters())[0];
}
const metadata=await fetch('https://data.ampmetropole.fr/api/explore/v2.1/catalog/datasets/fr-orthophoto-mamp-2022',{signal:AbortSignal.timeout(30000)}).then(r=>{if(!r.ok)throw Error('Métadonnées orthophoto indisponibles');return r.json()});
if(metadata.metas.default.license!=='Licence Ouverte 2.0 (Etalab)')throw Error('Licence métropolitaine à vérifier avant reconstruction.');
async function photo(bounds,resolution,name){
 const path=new URL(name,dir);try{await readFile(path);return;}catch{}
 const base=await marseilleOrthophoto(bounds,resolution,`coast-ign-v2-${name}`);
 const R=6378137,merc=(lon,lat)=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))],bbox=[...merc(bounds[0],bounds[1]),...merc(bounds[2],bounds[3])];
 const u=new URL('https://imageries.datasud.fr/orthothr');u.search=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:'MAMP',STYLES:'',CRS:'EPSG:3857',BBOX:bbox.join(','),WIDTH:String(resolution),HEIGHT:String(resolution),FORMAT:'image/png',TRANSPARENT:'TRUE'});
 const r=await fetch(u,{signal:AbortSignal.timeout(60000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/png'))throw Error(`Photo métropolitaine ${name}: ${r.status}`);
 // Transparent gaps over the open sea retain the IGN photograph underneath.
 const overlay=Buffer.from(await r.arrayBuffer());await writeFile(path,await sharp(base).composite([{input:overlay}]).jpeg({quality:90}).toBuffer());
}
async function model(grid,stride,stem,image,extras,geometricError,child){
 const name=`${stem}-${stride}.glb`; // Generated from the bundled grid by the server, then cached on the phone.
 return {boundingVolume:{box:tileBox(grid)},geometricError,refine:'REPLACE',content:{uri:name},extras:{bounds:grid.bounds,...extras},...(child?{children:Array.isArray(child)?child:[child]}:{})};
}
async function prepare(x,y){
 const stem=`${x}-${y}`,geo=tileBounds(x,y);let grid;
 try{grid=JSON.parse(gunzipSync(await readFile(new URL(stem+'.json.gz',dir))));}catch{
  let fallback;try{fallback=JSON.parse(await readFile(new URL(`../public/geodata/corniche-v1/${stem}.json`,import.meta.url),'utf8'));}catch{fallback=await marseilleOverview();}
  const boundary=await marseilleBoundary();
  const heights=await raster(geo,'MNT'),surface=await raster(geo,'MNS'),bounds=localBounds(geo);let measured=0;
  grid={bounds,size,heights:Array.from(heights,(h,i)=>{if(Number.isFinite(h)&&h>-100){measured++;return Math.round(Math.max(0,h)*100)/100;}const px=bounds[0]+(bounds[2]-bounds[0])*(i%size)/(size-1),pz=bounds[1]+(bounds[3]-bounds[1])*Math.floor(i/size)/(size-1);return inPolygons(px,pz,boundary.polygons)?Math.round(sampleGrid(fallback,px,pz)*100)/100:0;}),surfaceHeights:Array.from(surface,h=>Number.isFinite(h)&&h>-100?Math.round(Math.max(0,h)*100)/100:null),source:'IGN LiDAR HD MNT + MNS 50 cm ; RGE ALTI hors couverture',sample_spacing_m:(bounds[2]-bounds[0])/(size-1),no_data_height:0,cached_at:new Date().toISOString()};
  grid.lidar_samples=measured;if(!measured)throw Error(`Couverture LiDAR absente : ${stem}`);
  await writeFile(new URL(stem+'.json.gz',dir),gzipSync(JSON.stringify(grid),{level:9}));
 }

 await photo(geo,2048,stem+'-2048.jpg');
 const full=await readFile(new URL(stem+'-2048.jpg',dir));
 await writeFile(new URL(stem+'.jpg',dir),await sharp(full).resize(1024,1024).jpeg({quality:90}).toBuffer());
 const quarters=[];
 for(let q=0;q<4;q++){
  const part=splitTerrainGrid(grid,q);
  const image=`${stem}-q${q}.jpg`;await writeFile(new URL(image,dir),await sharp(full).extract({left:(q%2)*1024,top:Math.floor(q/2)*1024,width:1024,height:1024}).jpeg({quality:90}).toBuffer());
  const extras={key:`${x}/${y}`,quarter:q},leaf=await model(part,1,`${stem}-q${q}`,image,extras,0);
  quarters.push(await model(part,2,`${stem}-q${q}`,image,extras,grid.sample_spacing_m*2,leaf));
 }
 const subtree=await model(grid,8,stem,stem+'.jpg',{key:`${x}/${y}`},grid.sample_spacing_m*8,quarters);
 await writeFile(new URL(stem+'.tiles.json',dir),JSON.stringify({asset:{version:'1.1',gltfUpAxis:'Y'},geometricError:subtree.geometricError,root:subtree}));
 summaries.push({bounds:grid.bounds,heights:[0,grid.heights.reduce((a,b)=>Math.max(a,b),0)]});
 children.push({extras:subtree.extras,boundingVolume:subtree.boundingVolume,geometricError:subtree.geometricError,refine:'REPLACE',content:{uri:stem+'.tiles.json'}});
 console.log(stem,grid.lidar_samples,'points, pas',grid.sample_spacing_m.toFixed(2),'m');
}
let completed=0;
let cursor=0;async function worker(){while(cursor<tiles.length){const [x,y]=tiles[cursor++];let failure;for(let attempt=0;attempt<4;attempt++){try{await prepare(x,y);failure=null;break;}catch(error){failure=error;console.error(x,y,'tentative',attempt+1,error.message);await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));}}if(failure)throw failure;console.log('Progression',++completed,'/',tiles.length);}}
await Promise.all([worker(),worker(),worker()]);children.sort((a,b)=>a.content.uri.localeCompare(b.content.uri));
const all={bounds:[Math.min(...summaries.map(g=>g.bounds[0])),Math.min(...summaries.map(g=>g.bounds[1])),Math.max(...summaries.map(g=>g.bounds[2])),Math.max(...summaries.map(g=>g.bounds[3]))],heights:summaries.flatMap(g=>g.heights)};
await writeFile(new URL('tileset.json',dir),JSON.stringify({asset:{version:'1.1',gltfUpAxis:'Y',copyright:'IGN ; Métropole Aix-Marseille-Provence, orthophoto 2022 — Licence Ouverte 2.0'},geometricError:1000,root:{boundingVolume:{box:tileBox(all)},transform:Z_UP_TO_GAME,geometricError:1000,refine:'ADD',children}},null,2));
const provenance={coverage:{name:'Vieux-Port aux Calanques de Marseille',tiles:tiles.length,bounds:[5.32,43.16,5.57,43.302]},prepared_at:new Date().toISOString(),derived:true,terrain:{publisher:'IGN',source:'https://data.geopf.fr/wms-r',products:['LiDAR HD MNT 50 cm','LiDAR HD MNS 50 cm'],license:'Licence Ouverte 2.0'},imagery:{publisher:metadata.metas.default.publisher,capture:'2022-04-14 / 2022-07-04',updated_at:metadata.metas.default.modified,source:'https://data.ampmetropole.fr/explore/assets/fr-orthophoto-mamp-2022/',license:metadata.metas.default.license,source_resolution_m:.05,output_resolution_m:(summaries[0].bounds[2]-summaries[0].bounds[0])/2048,fallback:'IGN BD ORTHO pour les zones transparentes'},notes:'Reconstruction dérivée ; façades générées, aucun bâtiment photogrammétrique.'};
await writeFile(new URL('sources.json',dir),JSON.stringify(provenance,null,2));
const openLicense=await fetch('https://raw.githubusercontent.com/etalab/licence-ouverte/master/LO.md',{signal:AbortSignal.timeout(20000)}).then(r=>{if(!r.ok)throw Error('Texte de licence indisponible');return r.text()});
if(!openLicense.startsWith('# LICENCE OUVERTE 2.0'))throw Error('Texte de licence inattendu');
await writeFile(new URL('LICENCE-OUVERTE-2.0.md',dir),openLicense);
await writeFile(new URL('LICENSE.txt',dir),`IGN : LiDAR HD MNT/MNS et BD ORTHO ; données consultées le ${provenance.prepared_at.slice(0,10)}.\nMétropole Aix-Marseille-Provence : orthophoto 2022, mise à jour ${provenance.imagery.updated_at}. Co-financeurs Enedis et Région Sud.\nLicence Ouverte 2.0 : https://github.com/etalab/licence-ouverte/blob/master/LO.md\nSources et transformations : sources.json\nModèles reconstruits et textures rééchantillonnées ; aucune caution officielle des producteurs.\n`);
