import * as T from '../vendor/three/three.core.js';
import {tileAt,tileBounds,localBounds,toGeo} from './geo.js';
import {COAST_KEYS,coastAssets,COAST_TERRAIN_VERSION} from './coast-config.js';

// The overview supplies the distant landscape. Cache all detailed data in the
// visible streaming area, without constructing extra meshes on the phone.
export function viewportResources(camera,world,x,z,quality='balanced'){
 camera.updateMatrixWorld(true);
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const visible=b=>frustum.intersectsBox(new T.Box3(new T.Vector3(b[0],-1,b[1]),new T.Vector3(b[2],350,b[3])));
 const [cx,cy]=tileAt(...toGeo(x,z)),radius=quality==='mobile'?1:quality==='high'?3:2,tiles=[];
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const a=cx+dx,b=cy+dy,bounds=localBounds(tileBounds(a,b)),map=world.boundary.bounds;
  if(bounds[0]>map[2]||bounds[2]<map[0]||bounds[1]>map[3]||bounds[3]<map[1])continue;
  if((dx===0&&dy===0)||visible(bounds))tiles.push({key:`${a}/${b}`,bounds,d:dx*dx+dy*dy});
 }
 tiles.sort((a,b)=>a.d-b.d);
 const paths=['/api/marseille/boundary','/api/marseille/overview','/api/marseille/overview-imagery'];
 for(const tile of tiles){
  paths.push(`/api/marseille/terrain/${tile.key}?v=${COAST_KEYS.has(tile.key)?COAST_TERRAIN_VERSION:5}`,`/api/marseille/imagery/${tile.key}?size=${world.imageSizeFor({terrain:{bounds:tile.bounds}})}&v=4`,`/api/marseille/buildings/${tile.key}`,`/api/marseille/roads/${tile.key}`);
 }
 for(const key of COAST_KEYS){if(!visible(localBounds(tileBounds(...key.split('/').map(Number)))))continue;
  paths.push(...coastAssets(key));
 }
 return [...new Set(paths)];
}
export async function precacheViewport(paths,{win=window,onProgress=()=>{},concurrency=2}={}){
 const worker=win.navigator.serviceWorker;
 if(!win.isSecureContext||!worker||!win.caches)return{unsupported:true};
 // A first installation can outlast cacheReady's short startup grace period.
 // Wait for control here, while leaving the game playable.
 if(!worker.controller)await new Promise(resolve=>{
  const finish=()=>{win.clearTimeout(timer);worker.removeEventListener('controllerchange',changed);resolve();},changed=()=>{if(worker.controller)finish();};
  onProgress({waiting:true});
  // A slow Render wake-up/download is not evidence of an unsupported browser.
  // Keep listening after the notice; claim() can arrive much later on mobile.
  const timer=win.setTimeout(()=>onProgress({waiting:true,slow:true}),30000);
  worker.addEventListener('controllerchange',changed);worker.ready?.then(changed).catch(()=>{});changed();
 });
 let store;try{store=await win.caches.open('gabian-map-v1');}catch{return{unavailable:true};}
 const urls=[...new Set(paths)],result={total:urls.length,completed:0,cached:0,failed:0};let next=0;
 onProgress({...result});
 await Promise.all(Array.from({length:Math.min(concurrency,urls.length)},async()=>{
  while(next<urls.length){const path=urls[next++],url=new URL(path,win.location.origin);url.searchParams.sort();
   try{const response=await win.fetch(url.href);if(!response.ok)throw Error('Donnée indisponible');await response.arrayBuffer();if(await store.match(url.href))result.cached++;else result.failed++;}
   catch{result.failed++;}
   result.completed++;onProgress({...result});
  }
 }));
 return result;
}
