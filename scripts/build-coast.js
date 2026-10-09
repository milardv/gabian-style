import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fromArrayBuffer} from 'geotiff';
import {tileBounds,localBounds,sampleGrid} from '../public/flight/geo.js';
import {marseilleTerrain,marseilleImagery} from '../lib/marseille-data.js';
import {terrainGLB,tileBox,Z_UP_TO_GAME} from '../lib/terrain-tiles.js';
import {elevationGrid,elevationClient} from '../lib/elevation.js';
import {gzipSync} from 'node:zlib';
import {COAST_KEYS} from '../public/flight/coast-config.js';

const dir=new URL('../public/geodata/corniche-v1/',import.meta.url),size=257;
const tiles=[...COAST_KEYS].map(key=>key.split('/').map(Number)),children=[];
await mkdir(dir,{recursive:true});
for(const [x,y]of tiles){
 const stem=`${x}-${y}`;let grid;
 try{grid=JSON.parse(await readFile(new URL(stem+'.json',dir),'utf8'));}catch{
  const geo=tileBounds(x,y),bounds=localBounds(geo),R=6378137,merc=(lon,lat)=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
  const [w,s]=merc(geo[0],geo[1]),[e,n]=merc(geo[2],geo[3]),dx=(e-w)/(size-1),dy=(n-s)/(size-1);
  const url=new URL('https://data.geopf.fr/wms-r');url.search=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:'IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93',STYLES:'',CRS:'EPSG:3857',BBOX:[w-dx/2,s-dy/2,e+dx/2,n+dy/2].join(','),WIDTH:String(size),HEIGHT:String(size),FORMAT:'image/geotiff'});
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok||!response.headers.get('content-type')?.includes('geotiff'))throw Error(`LiDAR ${stem}: ${response.status}`);
  const image=await(await fromArrayBuffer(await response.arrayBuffer())).getImage(),raster=(await image.readRasters())[0];
  let fallback;try{fallback=await marseilleTerrain(x,y);}catch(error){
   if(!/Altitude IGN invalide/.test(error.message))throw error;
   // Ocean no-data may arrive just below -99999 after resampling. This build
   // sanitises those sentinels without relaxing the runtime API validation.
   fallback=await elevationGrid(bounds,81,elevationClient({fetcher:async(...args)=>{const r=await fetch(...args);if(!r.ok)return r;const data=await r.json();return Response.json({...data,elevations:data.elevations.map(h=>Number.isFinite(h)&&h<-1000?-99999:h)});}}));
  }
  let measured=0;const heights=Array.from(raster,(h,i)=>{if(Number.isFinite(h)&&h>-100){measured++;return Math.round(Math.max(0,h)*100)/100;}return Math.round(sampleGrid(fallback,bounds[0]+(bounds[2]-bounds[0])*(i%size)/(size-1),bounds[1]+(bounds[3]-bounds[1])*Math.floor(i/size)/(size-1))*100)/100;});
  if(measured<1000)throw Error(`Couverture LiDAR insuffisante : ${stem}`);
  grid={bounds,size,heights,source:'IGN LiDAR HD MNT 50 cm / RGE ALTI hors couverture',sample_spacing_m:(bounds[2]-bounds[0])/(size-1),lidar_samples:measured,no_data_height:0,cached_at:new Date().toISOString()};
  await writeFile(new URL(stem+'.json',dir),JSON.stringify(grid));
 }
 await writeFile(new URL(stem+'.jpg',dir),await marseilleImagery(x,y));
 const box=tileBox(grid),spacing=grid.sample_spacing_m;
 let child;for(const stride of [1,2,4]){const name=`${stem}-${stride}.glb`,bytes=terrainGLB(grid,stride,stem+'.jpg');await writeFile(new URL(name,dir),bytes);await writeFile(new URL(name+'.gz',dir),gzipSync(bytes,{level:9}));child={boundingVolume:{box},geometricError:stride===1?0:spacing*stride,refine:'REPLACE',content:{uri:name},extras:{bounds:grid.bounds,key:`${x}/${y}`},...(child?{children:[child]}:{})};}
 children.push(child);console.log(stem,grid.lidar_samples,'points LiDAR, pas',spacing.toFixed(2),'m');
}
const grids=await Promise.all(tiles.map(([x,y])=>readFile(new URL(`${x}-${y}.json`,dir),'utf8').then(JSON.parse))),all={bounds:[Math.min(...grids.map(g=>g.bounds[0])),Math.min(...grids.map(g=>g.bounds[1])),Math.max(...grids.map(g=>g.bounds[2])),Math.max(...grids.map(g=>g.bounds[3]))],heights:grids.flatMap(g=>g.heights)};
await writeFile(new URL('tileset.json',dir),JSON.stringify({asset:{version:'1.1',gltfUpAxis:'Y'},geometricError:1000,root:{boundingVolume:{box:tileBox(all)},transform:Z_UP_TO_GAME,geometricError:1000,refine:'REPLACE',children}},null,2));
await writeFile(new URL('LICENSE.txt',dir),'Relief : IGN LiDAR HD MNT (source au pas de 50 cm, échantillonnage du jeu à environ 3,5 m). Hors couverture : IGN RGE ALTI. Orthophotographies : IGN BD ORTHO. Licence Ouverte Etalab 2.0 : https://www.etalab.gouv.fr/licence-ouverte-open-licence/\nSource : https://data.geopf.fr/wms-r\nSecteur pilote Corniche–Malmousque ; aucun bâtiment photogrammétrique inclus.\n');
