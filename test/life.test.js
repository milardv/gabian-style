import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.core.js';
import {LIFE_SCENES,ferryProgress,sardineActive,nearbyReaction,coastalUpdraft} from '../public/flight/life-rules.js';
import {MarseilleLife} from '../public/flight/marseille-life.js';
import {Exploration} from '../public/flight/exploration.js';
import {CityWorld} from '../public/flight/world.js';
const position=s=>({x:s.x,z:s.z,altitude:75});
const world=()=>({ground:()=>10,surface:()=>10});
test('Ferry : traversée continue, escales et retour',()=>{
 assert.equal(ferryProgress(0),0);assert.equal(ferryProgress(15),0);assert.equal(ferryProgress(45),.5);assert.equal(ferryProgress(85),1);assert.equal(ferryProgress(125),.5);assert.equal(ferryProgress(160),0);
 for(let i=0;i<10000;i++){const t=i*.1;assert.ok(Math.abs(ferryProgress(t+.1)-ferryProgress(t))<.002);}
});
test('Sardine : événement borné, récurrent, sans apparaître avant son délai',()=>{
 assert.equal(sardineActive(44,45),false);assert.equal(sardineActive(45,45),true);assert.equal(sardineActive(130,45),false);assert.equal(sardineActive(525,45),true);
});
test('Réactions locales seulement, et ascendance limitée à la côte par mistral',()=>{
 const port=LIFE_SCENES[0],coast=LIFE_SCENES[3];assert.equal(nearbyReaction(position(port)).id,'ferry');assert.equal(nearbyReaction({...position(port),altitude:1000}),null);
 assert.equal(coastalUpdraft(position(coast),2),0);assert.ok(coastalUpdraft(position(coast),8)>0);assert.equal(coastalUpdraft({x:0,z:0},12),0);
});
test('Scènes : construction paresseuse, positions finies, pause et réutilisation',()=>{
 const notices=[],w=world(),scene=new T.Scene(),life=new MarseilleLife(scene,w,text=>notices.push(text),{sardineDelay:0});
 for(const item of LIFE_SCENES){life.update(.016,position(item),8,false);const built=life.scenes.find(s=>s.id===item.id);assert.equal(built.built,true,`${item.id} doit être construit`);}
 const count=scene.children.length,panier=LIFE_SCENES[5];life.update(.016,position(panier),8,false);assert.equal(life.react(position(panier)),'panier');assert.equal(life.react(position(panier)),null);
 for(let i=0;i<100;i++)life.update(.016,position(panier),8,false);
 const bird=life.scenes[5].gulls[0].bird.root,before=bird.position.clone(),clock=life.time;life.update(.1,position(panier),8,true);assert.equal(life.time,clock);assert.ok(bird.position.equals(before));
 assert.equal(scene.children.length,count);
 scene.traverse(o=>assert.ok(o.position.toArray().every(Number.isFinite)));
 life.update(.016,{x:90000,z:90000,altitude:100},8,false);assert.equal(w.lifeLandmarks.length,0);assert.ok(life.scenes.every(s=>!s.root.visible));
});
test('Souvenir de scène unique même si son décor se décale pour éviter un bâtiment',()=>{
 const exploration=new Exploration(),scene={...LIFE_SCENES[2],ground:10,height:20};exploration.update(position(scene),[scene]);
 assert.equal(exploration.count,1);assert.equal(exploration.has({...scene,x:scene.x+40,z:scene.z+20}),true);
});
test('Les scènes rejoignent les lieux IGN pour les visites et la carte',()=>{
 const item={...LIFE_SCENES[2],ground:10,height:20},w={tiles:new Map(),lifeLandmarks:[item],ground:()=>10};
 const nearby=CityWorld.prototype.nearbyLandmarks.call(w,item.x,item.z,200);assert.equal(nearby.length,1);assert.equal(nearby[0].id,'market');
});
test('Décor urbain attend les bâtiments IGN et évite les chargements répétés',async()=>{
 const s=LIFE_SCENES[2];let calls=0,resolve;const request=new Promise(r=>resolve=r),w={...world(),tiles:new Map(),prime(){calls++;return request;}},life=new MarseilleLife(new T.Scene(),w,()=>{});
 life.update(.016,position(s),2,false);life.update(.016,position(s),2,false);assert.equal(calls,1);assert.equal(life.scenes[2].built,false);resolve();await request;
});
