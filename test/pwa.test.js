import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setupPwa,waitForCache} from '../public/pwa.js';
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
 const win={isSecureContext:true,navigator:{userAgent:ios?'iPhone':'Android',serviceWorker:{register(...args){registrations.push(args);return Promise.resolve({addEventListener(){}});}}},matchMedia:()=>media,addEventListener(type,fn){handlers[type]=fn;}};
 const doc={readyState:'complete',querySelectorAll:selector=>selector==='[data-install]'?buttons:selector==='[data-install-help]'?help:[]};setupPwa(win,doc);return{handlers,buttons,help,media,registrations};
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

function cacheFixture(storage){
 const handlers={},statuses=[{},{}],updates=[{},{}],clear=[{},{}],calls=[];
 const registration={addEventListener(){},waiting:null};
 const win={isSecureContext:true,navigator:{storage,userAgent:'Android',serviceWorker:{register(...args){calls.push(args);return Promise.resolve(registration);},addEventListener(){}}},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(type,fn){handlers[type]=fn;},removeEventListener(type,fn){if(handlers[type]===fn)delete handlers[type];}};
 const groups={'[data-cache-status]':statuses,'[data-pwa-update]':updates,'[data-clear-map-cache]':clear};
 setupPwa(win,{readyState:'loading',querySelectorAll:selector=>groups[selector]||[],addEventListener(){}});
 return{handlers,statuses,updates,calls,registration};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Cache par défaut : inscription immédiate et conservation durable automatique, sans bouton',async()=>{
 let requests=0;
 const f=cacheFixture({persisted:async()=>false,persist:async()=>{requests++;return true;}});
 assert.equal(f.calls.length,1);assert.equal(f.handlers.load,undefined);
 await flush();assert.equal(requests,1);
 assert.ok(f.statuses.every(status=>/Cache actif.*durable autorisée/.test(status.textContent)));
 f.handlers.pointerdown();await flush();assert.equal(requests,1);
 assert.equal(f.handlers.keydown,undefined);
});
test('Cache : une conservation déjà autorisée ne provoque aucune nouvelle demande',async()=>{
 let requests=0;
 const f=cacheFixture({persisted:async()=>true,persist:async()=>{requests++;return true;}});
 await flush();assert.equal(requests,0);assert.ok(f.statuses.every(status=>/durable/.test(status.textContent)));
});
test('Cache actif après refus : nouvelle tentative automatique sur interaction, une seule fois',async()=>{
 let requests=0;
 const f=cacheFixture({persisted:async()=>false,persist:async()=>++requests>1});
 await flush();assert.equal(requests,1);assert.ok(f.statuses.every(status=>/Cache actif automatiquement/.test(status.textContent)));
 f.handlers.keydown();await flush();assert.equal(requests,2);
 assert.equal(f.handlers.pointerdown,undefined);assert.ok(f.statuses.every(status=>/durable autorisée/.test(status.textContent)));
});
test('Cache : erreur ou API de conservation absente ne bloque pas le service worker',async()=>{
 const f=cacheFixture({persist:async()=>{throw Error('unsupported');}});
 await flush();assert.equal(f.calls.length,1);assert.ok(f.statuses.every(status=>/Cache actif automatiquement/.test(status.textContent)));
 const unsupported=cacheFixture(undefined);await flush();assert.equal(unsupported.calls.length,1);assert.equal(unsupported.handlers.pointerdown,undefined);
});
test('Mises à jour : les boutons des deux panneaux suivent le même worker',async()=>{
 const f=cacheFixture(undefined);f.registration.waiting={postMessage(){}};
 await flush();assert.ok(f.updates.every(button=>button.hidden===false&&typeof button.onclick==='function'));
});

test('Première visite : attendre le contrôle du worker avant de charger la carte',async()=>{
 const handlers={},worker={controller:null,addEventListener(type,fn){handlers[type]=fn;},removeEventListener(type){delete handlers[type];}};
 let expire,cleared=false,finished=false;
 const win={isSecureContext:true,navigator:{serviceWorker:worker},setTimeout(fn){expire=fn;return 1;},clearTimeout(){cleared=true;}};
 const ready=waitForCache(win).then(()=>{finished=true;});
 await flush();assert.equal(finished,false);
 worker.controller={};handlers.controllerchange();await ready;
 assert.equal(finished,true);assert.equal(cleared,true);assert.equal(handlers.controllerchange,undefined);
});
test('Cache : délai borné, aucune attente quand déjà contrôlé ou non compatible',async()=>{
 let expire;
 const worker={controller:null,addEventListener(){},removeEventListener(){}};
 const win={isSecureContext:true,navigator:{serviceWorker:worker},setTimeout(fn){expire=fn;return 1;},clearTimeout(){}};
 const ready=waitForCache(win);expire();await ready;
 worker.controller={};await waitForCache({...win,setTimeout(){throw Error('No timer expected');}});
 await waitForCache({isSecureContext:false,navigator:{}});
});
