import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.core.js';
import {viewportResources,precacheViewport} from '../public/flight/viewport-cache.js';
import {toLocal,localBounds,tileAt} from '../public/flight/geo.js';

test('initial viewport includes full data for visible tiles and omits distant/behind tiles',()=>{
 const [x,z]=toLocal(5.3738,43.295),camera=new T.PerspectiveCamera(65,1,.08,35000);camera.position.set(x,120,z);camera.lookAt(x,0,z-2000);
 const world={boundary:{bounds:localBounds([5.2,43.16,5.57,43.43])},imageSizeFor:()=>1024};
 const paths=viewportResources(camera,world,x,z,'mobile'),[tx,ty]=tileAt(5.3738,43.295);
 assert.ok(paths.includes(`/api/marseille/roads/${tx}/${ty}`));assert.ok(paths.includes(`/api/marseille/buildings/${tx}/${ty}`));assert.ok(paths.includes(`/api/marseille/imagery/${tx}/${ty}?size=1024&v=4`));assert.ok(paths.includes('/api/marseille/overview-imagery'));
 assert.ok(!paths.includes(`/api/marseille/roads/${tx}/${ty+1}`));assert.ok(!paths.includes(`/api/marseille/roads/${tx}/${ty-2}`));assert.equal(new Set(paths).size,paths.length);
 assert.ok(viewportResources(camera,world,x,z,'high').length>paths.length);
});
test('visible native coastal tiles include every LOD and their photographs',()=>{
 const [x,z]=toLocal(5.35,43.28),camera=new T.PerspectiveCamera(65,1,.08,35000);camera.position.set(x,300,z);camera.lookAt(x,0,z);
 const world={boundary:{bounds:localBounds([5.2,43.16,5.57,43.43])},imageSizeFor:()=>1024},paths=viewportResources(camera,world,x,z,'mobile');
 assert.ok(paths.includes('/geodata/corniche-v2/tileset.json'));
 assert.ok(paths.includes('/geodata/corniche-v2/16870-12005-8.glb'));
 for(let q=0;q<4;q++)for(const stride of [1,2])assert.ok(paths.includes(`/geodata/corniche-v2/16870-12005-q${q}-${stride}.glb`));
 assert.ok(paths.includes('/geodata/corniche-v2/16870-12005.jpg'));
});
function fixture(){
 const entries=new Map(),worker={controller:{}};let active=0,maximum=0,calls=0;
 const win={isSecureContext:true,navigator:{serviceWorker:worker},location:{origin:'https://gabian.example'},caches:{open:async()=>({match:async url=>entries.get(url)})},fetch:async url=>{calls++;active++;maximum=Math.max(maximum,active);await new Promise(r=>setImmediate(r));active--;if(url.includes('bad'))return new Response('',{status:502});entries.set(url,true);return new Response('data');}};
 return{win,entries,worker,get maximum(){return maximum;},get calls(){return calls;}};
}
test('prefetch is bounded, deduplicated and records partial failure without cancelling the rest',async()=>{
 const f=fixture(),progress=[];
 const result=await precacheViewport(['/one','/one','/two','/bad','/three'],{win:f.win,onProgress:value=>progress.push(value)});
 assert.equal(f.maximum,2);assert.equal(f.calls,4);assert.deepEqual(result,{total:4,completed:4,cached:3,failed:1});assert.equal(progress.at(-1).completed,4);
 assert.ok(progress.every((value,i)=>!i||value.completed>=progress[i-1].completed));
});
test('first visit waits for service-worker control before requesting geographic data',async()=>{
 const f=fixture();f.worker.controller=null;let changed;
 f.win.setTimeout=setTimeout;f.win.clearTimeout=clearTimeout;f.worker.addEventListener=(_type,listener)=>changed=listener;f.worker.removeEventListener=()=>{};
 const pending=precacheViewport(['/first'],{win:f.win});await new Promise(r=>setImmediate(r));assert.equal(f.calls,0);
 f.worker.controller={};changed();await pending;assert.equal(f.calls,1);
});
test('installation beyond 30 seconds remains pending, then preloads when the worker claims the page',async()=>{
 const f=fixture(),progress=[];f.worker.controller=null;let changed,timer,finished=false;
 f.win.setTimeout=callback=>{timer=callback;return 1;};f.win.clearTimeout=()=>{};
 f.worker.addEventListener=(_type,listener)=>changed=listener;f.worker.removeEventListener=()=>{};
 const pending=precacheViewport(['/slow-first-install'],{win:f.win,onProgress:v=>progress.push(v)}).then(result=>{finished=true;return result;});
 timer();await new Promise(r=>setImmediate(r));assert.equal(finished,false);assert.equal(f.calls,0);assert.deepEqual(progress.at(-1),{waiting:true,slow:true});
 f.worker.controller={};changed();assert.equal((await pending).cached,1);assert.equal(progress.at(-1).completed,1);
});
test('unsupported APIs and actual storage denial are distinct from a pending installation',async()=>{
 const f=fixture();f.win.isSecureContext=false;assert.deepEqual(await precacheViewport([],{win:f.win}),{unsupported:true});
 f.win.isSecureContext=true;f.win.caches.open=async()=>{throw Error('Storage denied');};assert.deepEqual(await precacheViewport([],{win:f.win}),{unavailable:true});
});
