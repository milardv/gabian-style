import test from 'node:test';
import assert from 'node:assert/strict';
import {FullscreenControls} from '../public/flight/fullscreen.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({supported=true,landscape=false,coarse=true}={}){
 const handlers={},media={landscape:{matches:landscape,addEventListener(type,fn){this.change=fn;}},coarse:{matches:coarse}};
 let blocked=false,requests=0,started=true;
 const doc={fullscreenElement:null,documentElement:{},addEventListener(type,fn){handlers[type]=fn;},async exitFullscreen(){this.fullscreenElement=null;handlers.fullscreenchange();}};
 if(supported)doc.documentElement.requestFullscreen=async()=>{requests++;if(blocked)throw Error('activation needed');doc.fullscreenElement=doc.documentElement;handlers.fullscreenchange();};
 const buttons=Array.from({length:3},()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;},querySelector(){return null;}}));
 const notices=[];const controls=new FullscreenControls(doc,{matchMedia:q=>q.includes('orientation')?media.landscape:media.coarse},buttons,()=>started,()=>{},m=>notices.push(m));
 return{controls,doc,media,buttons,notices,handlers,get requests(){return requests;},block(value){blocked=value;},start(value){started=value;}};
}
test('Plein écran manuel : entrer, synchroniser les boutons et sortir',async()=>{
 const f=fixture();await f.buttons[0].onclick();assert.equal(f.controls.active,true);assert.equal(f.buttons[1].textContent,'Quitter le plein écran');
 await f.buttons[2].onclick();assert.equal(f.controls.active,false);assert.equal(f.controls.pending,false);assert.equal(f.buttons[0].attrs['aria-pressed'],false);
});
test('Paysage : tenter automatiquement, puis reprendre sur un toucher si refusé',async()=>{
 const f=fixture();f.block(true);f.media.landscape.matches=true;f.media.landscape.change();await flush();assert.equal(f.requests,1);assert.equal(f.controls.pending,true);assert.equal(f.notices.length,0);
 f.block(false);f.handlers.pointerup({isTrusted:true,target:{}});await flush();assert.equal(f.controls.active,true);assert.equal(f.controls.pending,false);
});
test('Sortie volontaire : ne pas forcer de nouveau le plein écran au prochain toucher',async()=>{
 const f=fixture({landscape:true});f.controls.landscapeChanged();await flush();await f.controls.toggle();
 f.handlers.pointerup({isTrusted:true,target:{}});await flush();assert.equal(f.requests,1);assert.equal(f.controls.active,false);
 f.media.landscape.matches=false;f.media.landscape.change();f.media.landscape.matches=true;f.media.landscape.change();await flush();assert.equal(f.requests,2);
});
test('Pas d’automatisme sur ordinateur, avant départ ou après retour en portrait',async()=>{
 const desktop=fixture({coarse:false,landscape:true});desktop.controls.landscapeChanged();await flush();assert.equal(desktop.requests,0);
 const f=fixture({landscape:true});f.start(false);f.controls.landscapeChanged();await flush();assert.equal(f.requests,0);
 f.block(true);f.controls.landscapeChanged(true);await flush();assert.equal(f.controls.pending,true);f.media.landscape.matches=false;f.media.landscape.change();assert.equal(f.controls.pending,false);
});
test('Navigateur sans API : boutons désactivés et aucun automatisme',async()=>{
 const f=fixture({supported:false,landscape:true});f.controls.landscapeChanged();await flush();assert.equal(f.requests,0);assert.equal(f.buttons[0].disabled,true);
});
