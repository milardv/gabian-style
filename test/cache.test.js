import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {pwaAssets,renderWorker} from '../lib/pwa-assets.js';
const context={};vm.runInNewContext(await readFile(new URL('../public/cache-store.js',import.meta.url),'utf8'),context);
const {MapCache,budget}=context.GabianCache;
class MemoryCache {
 constructor(){this.entries=new Map();this.fail=false;}
 async keys(){return [...this.entries.keys()].map(url=>({url}));}
 async match(key){return this.entries.get(typeof key==='string'?key:key.url)?.clone();}
 async put(key,response){if(this.fail){this.fail=false;const e=Error('full');e.name='QuotaExceededError';throw e;}this.entries.set(typeof key==='string'?key:key.url,response.clone());}
 async delete(key){return this.entries.delete(typeof key==='string'?key:key.url);}
}
class MemoryMetadata {
 constructor(){this.entries=new Map();}
 async all(){return [...this.entries.values()].map(value=>({...value}));}
 async put(value){this.entries.set(value.url,{...value});}
 async delete(key){this.entries.delete(key);}
 async clear(){this.entries.clear();}
}
const response=bytes=>new Response('x'.repeat(bytes),{headers:{'Content-Type':'application/json'}});
test('Budget : jusqu’à 1 Go, réserve de stockage et repli sans estimation',()=>{
 assert.equal(budget({quota:10*1024**3,usage:0}),1024**3);
 assert.equal(budget({quota:1000,usage:900}),75);
 assert.equal(budget({quota:1000,usage:900},100),150);
 assert.equal(budget({}),256*1024**2);assert.equal(budget({quota:1000,usage:1200}),0);
});
test('Carte : cache durable entre workers, limite en octets et éviction des moins récemment utilisés',async()=>{
 const cache=new MemoryCache(),metadata=new MemoryMetadata();let now=100000;
 const store=new MapCache(cache,metadata,{estimate:async()=>({quota:1000,usage:0})},()=>now);
 for(const name of ['a','b','c']){await store.put(name,response(100));now+=40000;}
 await store.get('a');await store.queue;now+=40000;
 await store.put('d',response(100));await store.put('e',response(100));
 assert.ok(await store.get('a'));assert.equal(await store.get('b'),null);assert.equal((await store.stats()).bytes,400);
 const restarted=new MapCache(cache,metadata,{},()=>now);assert.equal((await restarted.stats()).count,4);assert.ok(await restarted.get('e'));
});
test('Quota plein : libérer de la place et réessayer sans bloquer ; vidage limité à la carte',async()=>{
 const cache=new MemoryCache(),metadata=new MemoryMetadata(),store=new MapCache(cache,metadata,{estimate:async()=>({quota:1000,usage:0})});
 await store.put('a',response(100));await store.put('b',response(100));cache.fail=true;await store.put('c',response(100));assert.ok(await store.get('c'));
 await store.clear();assert.equal((await store.stats()).bytes,0);assert.equal((await cache.keys()).length,0);assert.equal(metadata.entries.size,0);
});
test('Cache : refus des erreurs et fichiers trop gros, écritures concurrentes bornées',async()=>{
 const cache=new MemoryCache(),store=new MapCache(cache,new MemoryMetadata(),{estimate:async()=>({quota:1000,usage:0})});
 await store.put('bad',new Response('error',{status:502}));await store.put('large',response(500));assert.equal((await store.stats()).count,0);
 await Promise.all(Array.from({length:12},(_,i)=>store.put(String(i),response(100))));const stats=await store.stats();assert.equal(stats.bytes,400);assert.equal(stats.count,4);
});
test('Déploiements : version automatique selon les fichiers, manifeste de précache cohérent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gabian-assets-'));
 try{await writeFile(join(dir,'index.html'),'first');await writeFile(join(dir,'game.js'),'first');await writeFile(join(dir,'sw.js'),'worker');
  const before=pwaAssets(dir);assert.ok(before.assets.includes('/'));assert.ok(before.assets.includes('/game.js'));assert.ok(!before.assets.includes('/sw.js'));
  await writeFile(join(dir,'game.js'),'changed');const after=pwaAssets(dir);assert.notEqual(after.version,before.version);
  const built=renderWorker("const v='__GABIAN_VERSION__',a='__GABIAN_ASSETS__';",after);assert.ok(!built.includes('__GABIAN_'));
 }finally{await rm(dir,{recursive:true});}
});
async function workerFixture(){
 const handlers={},stores=new Map(),deleted=[],metadata=new MemoryMetadata();let calls=0,clock=Date.now();class Clock extends Date{static now(){return clock;}}
 const shell=new MemoryCache();await shell.put('/?build=test',new Response('cached-game'));await shell.put('/offline.html?build=test',new Response('offline-page'));stores.set('gabian-shell-test',shell);
 let network=async request=>{calls++;return new Response('live-data',{headers:{'Content-Type':String(request.url||request).includes('/api/')?'application/json':'text/html','X-Gabian-Version':'test'}});};
 const context={URL,Response,Promise,Date:Clock,GabianCache:{MapCache,Metadata:class{constructor(){return metadata;}}},importScripts(){},self:{indexedDB:{},navigator:{storage:{estimate:async()=>({quota:10*1024**3,usage:0})}},location:{origin:'https://gabian.example'},clients:{claim:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn},fetch:(...args)=>network(...args),caches:{open:async name=>{if(!stores.has(name))stores.set(name,new MemoryCache());return stores.get(name);},keys:async()=>['gabian-offline-v1','gabian-shell-old','gabian-shell-test','gabian-map-v1','other-app'],delete:async key=>deleted.push(key)}};
 vm.runInNewContext(renderWorker(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{version:'test',assets:['/','/offline.html','/flight/app.js']}),context);
 const run=async(type,event={})=>{let response,background;handlers[type]({...event,waitUntil:p=>background=p,respondWith:p=>response=p});const result=response?await response:undefined;if(background)await background;return result;};
 return{run,stores,deleted,advance:ms=>clock+=ms,network:fn=>network=fn,get calls(){return calls;},request:(path,mode='cors')=>({url:'https://gabian.example'+path,method:'GET',mode})};
}
test('Worker : visite suivante depuis le cache, aucune requête sur une zone fraîche',async()=>{
 const f=await workerFixture(),request=f.request('/api/marseille/terrain/1/2');
 assert.equal(await(await f.run('fetch',{request})).text(),'live-data');assert.equal(f.calls,1);
 f.network(()=>{throw Error('offline');});assert.equal(await(await f.run('fetch',{request})).text(),'live-data');assert.equal(f.calls,1);
 const page=await f.run('fetch',{request:f.request('/','navigate')});assert.equal(await page.text(),'cached-game');
});
test('Worker : tuiles 3D et orthophotos du pilote restent disponibles hors ligne',async()=>{
 const f=await workerFixture();
 const resources=[['tileset.json','application/json'],['16871-12005-1.glb','model/gltf-binary'],['16871-12005.jpg','image/jpeg']];
 for(const [name,type]of resources){f.network(async()=>new Response('tile-'+name,{headers:{'Content-Type':type}}));await f.run('fetch',{request:f.request('/geodata/corniche-v1/'+name)});}
 f.network(async()=>{throw Error('offline');});
 for(const [name]of resources)assert.equal(await(await f.run('fetch',{request:f.request('/geodata/corniche-v1/'+name)})).text(),'tile-'+name);
 assert.equal((await f.stores.get('gabian-map-v1').keys()).length,3);
});
test('Worker : garder la carte aux mises à jour et ne pas cacher les missions aléatoires',async()=>{
 const f=await workerFixture();await f.run('activate');assert.deepEqual(f.deleted,['gabian-offline-v1','gabian-shell-old']);
 assert.equal(await f.run('fetch',{request:f.request('/api/marseille/mission')}),undefined);
});
test('Worker : version remplacée durant le précache refusée, réponse HTML jamais conservée comme tuile',async()=>{
 const f=await workerFixture();f.network(async()=>new Response('render-loading',{headers:{'Content-Type':'text/html'}}));
 await assert.rejects(f.run('install'),/Déploiement incomplet/);
 const request=f.request('/api/marseille/buildings/1/2');await f.run('fetch',{request});assert.equal((await f.stores.get('gabian-map-v1').keys()).length,0);
});
test('Worker : rafraîchissement différé des anciennes données, cache conservé si le réseau échoue',async()=>{
 const f=await workerFixture(),request=f.request('/api/marseille/roads/1/2');await f.run('fetch',{request});f.advance(31*86400000);
 let refreshed=0;f.network(async()=>{refreshed++;return new Response('updated-roads',{headers:{'Content-Type':'application/json'}});});
 const old=await f.run('fetch',{request});assert.equal(await old.text(),'live-data');assert.equal(refreshed,1);
 f.network(async()=>{throw Error('offline');});const saved=await f.run('fetch',{request});assert.equal(await saved.text(),'updated-roads');
});
test('Worker : deux téléchargements simultanés d’une tuile partagent la même requête',async()=>{
 const f=await workerFixture(),request=f.request('/api/marseille/terrain/3/4');let downloads=0,release;
 const gate=new Promise(resolve=>release=resolve);f.network(async()=>{downloads++;await gate;return response(100);});
 const a=f.run('fetch',{request}),b=f.run('fetch',{request});await new Promise(resolve=>setImmediate(resolve));release();const results=await Promise.all([a,b]);
 assert.equal(downloads,1);assert.equal(await results[0].text(),await results[1].text());
});
