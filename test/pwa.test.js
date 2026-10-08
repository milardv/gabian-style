import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {setupPwa} from '../public/pwa.js';
test('Manifest : identité stable, lancement autonome, icônes Android et Apple aux bonnes tailles',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
 for(const size of [192,512])assert.ok(manifest.icons.some(icon=>icon.sizes===`${size}x${size}`&&icon.purpose==='any'));
 assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
 for(const icon of [...manifest.icons,{src:'/icons/apple-touch-icon.png',sizes:'180x180'}]){
  const bytes=await readFile(new URL('../public'+icon.src,import.meta.url));assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);
 }
});
function installFixture({standalone=false,ios=false}={}){
 const handlers={},buttons=[{},{}],help=[{},{}],media={matches:standalone,addEventListener(type,fn){this.change=fn;}},registrations=[];
 const win={isSecureContext:true,navigator:{userAgent:ios?'iPhone':'Android',serviceWorker:{register(...args){registrations.push(args);return Promise.resolve();}}},matchMedia:()=>media,addEventListener(type,fn){handlers[type]=fn;}};
 const doc={readyState:'complete',querySelectorAll:selector=>selector==='[data-install]'?buttons:help};setupPwa(win,doc);return{handlers,buttons,help,media,registrations};
}
test('Installation : prompt natif consommé une seule fois, boutons masqués après installation',async()=>{
 const f=installFixture();let calls=0,prevented=false;
 f.handlers.beforeinstallprompt({preventDefault(){prevented=true;},async prompt(){calls++;},userChoice:Promise.resolve({outcome:'accepted'})});
 await f.buttons[0].onclick();assert.ok(prevented);assert.equal(calls,1);assert.equal(f.buttons[0].disabled,false);
 f.handlers.appinstalled();assert.ok(f.buttons.every(button=>button.hidden));assert.ok(f.help.every(el=>el.hidden));
 assert.equal(f.registrations[0][0],'/sw.js');assert.equal(f.registrations[0][1].scope,'/');
});
test('Installation iPhone : instructions explicites ; mode autonome : pas de bouton inutile',async()=>{
 const f=installFixture({ios:true});await f.buttons[0].onclick();assert.match(f.help[0].textContent,/Safari.*Sur l’écran d’accueil/);assert.equal(f.help[0].hidden,false);
 const installed=installFixture({standalone:true});assert.ok(installed.buttons.every(button=>button.hidden));
});
async function workerFixture(){
 const handlers={},stored=new Map([['/offline.html',new Response('offline-page')],['/icons/icon-192.png',new Response('icon')]]),deleted=[],preloaded=[];let network=()=>Promise.resolve(new Response('online-game'));
 const context={URL,Response,self:{location:{origin:'https://gabian.example'},clients:{claim:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn},fetch:request=>network(request),caches:{open:async()=>({addAll:async paths=>preloaded.push(...paths)}),match:async key=>stored.get(key)?.clone(),keys:async()=>['gabian-offline-v0','gabian-offline-v1','another-app'],delete:async key=>deleted.push(key)}};
 vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 const run=async(type,event={})=>{let pending;handlers[type]({...event,waitUntil:p=>pending=p,respondWith:p=>pending=p});return pending?await pending:undefined;};
 return{run,deleted,preloaded,network:fn=>network=fn,request:(path,mode='navigate')=>({url:'https://gabian.example'+path,method:'GET',mode})};
}
test('Worker : nouvelle page en ligne, secours hors ligne ou serveur indisponible',async()=>{
 const f=await workerFixture();let response=await f.run('fetch',{request:f.request('/')});assert.equal(await response.text(),'online-game');
 f.network(()=>Promise.reject(Error('offline')));response=await f.run('fetch',{request:f.request('/')});assert.equal(await response.text(),'offline-page');
 f.network(()=>Promise.resolve(new Response('upstream unavailable',{status:503})));response=await f.run('fetch',{request:f.request('/')});assert.equal(await response.text(),'offline-page');
});
test('Worker : aucune interception des tuiles, API ou modules ; cache de secours borné',async()=>{
 const f=await workerFixture();await f.run('install');assert.deepEqual(f.preloaded,['/offline.html','/icons/icon-192.png']);await f.run('activate');assert.deepEqual(f.deleted,['gabian-offline-v0']);
 for(const path of ['/api/marseille/terrain/1/2','/api/marseille/mission','/flight/app.js','/flight/flight.css'])assert.equal(await f.run('fetch',{request:f.request(path,'cors')}),undefined);
});
