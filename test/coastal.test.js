import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.core.js';
import {divePose,grillSmoke,DIVE_CYCLE} from '../public/flight/coastal-motion.js';
import {MarseilleLife} from '../public/flight/marseille-life.js';
import {LIFE_SCENES} from '../public/flight/life-rules.js';
const definition=id=>LIFE_SCENES.find(s=>s.id===id);
const position=s=>({x:s.x,z:s.z,altitude:30});
function fixture(options={}){return new MarseilleLife(new T.Scene(),{ground:()=>0,surface:()=>0},()=>{},{sardineDelay:99999,...options});}
test('Plongeon : parabole sous gravité, salto et entrée continue dans la mer',()=>{
 const height=17,distance=27,flight=divePose(0,0,height,distance).flight;
 const launch=divePose(2.4,0,height,distance),mid=divePose(2.4+flight/2,0,height,distance);
 assert.equal(launch.y,height);assert.equal(launch.forward,0);assert.equal(mid.forward,distance/2);
 assert.ok(mid.tuck>.9);assert.ok(mid.spin>Math.PI);
 const before=divePose(2.4+flight-.0001,0,height,distance),after=divePose(2.4+flight+.0001,0,height,distance);
 assert.ok(Math.abs(before.y-after.y)<.005);assert.ok(Math.abs(before.spin-after.spin)<.005);
 assert.ok(after.cheering);assert.ok(after.splash>=0);assert.ok(Math.abs(after.forward-distance)<.001);
 assert.equal(divePose(2.4+flight+4,0,height,distance).cheering,false);
 for(let t=2.5;t<2.4+flight-.1;t+=.1){const a=divePose(t-.001,0,height,distance),b=divePose(t,0,height,distance),c=divePose(t+.001,0,height,distance);assert.ok(Math.abs((a.y-2*b.y+c.y)/.000001+9.81)<.001);}
});
test('Plongeurs : départs décalés, aucune valeur infinie, mouvement réduit sans salto',()=>{
 const height=17,distance=27;
 assert.notEqual(divePose(3,0,height,distance).phase,divePose(3,1,height,distance).phase);
 for(let t=0;t<DIVE_CYCLE*2;t+=.03)for(let i=0;i<3;i++){
  const pose=divePose(t,i,height,distance);assert.ok(Object.values(pose).filter(v=>typeof v==='number').every(Number.isFinite));
 }
 assert.equal(divePose(3,0,height,distance,{reducedMotion:true}).spin,0);
});
test('Corniche : félicitations au splash, une seule fois, pause et éloignement respectés',()=>{
 const cheers=[],life=fixture({celebrate:id=>cheers.push(id)}),s=definition('divers');
 life.update(0,position(s),2,false);const built=life.scenes.find(item=>item.id==='divers');
 assert.equal(built.divers.length,3);assert.equal(built.crowd.length,8);assert.equal(built.arms.count,16);
 const flight=divePose(0,0,17.35,built.diveDistance).flight;
 life.time=2.4+flight+.1;life.update(0,position(s),2,false);assert.equal(cheers.length,1);
 const actor=built.divers[0].root,before=actor.position.clone(),clock=life.time;
 life.update(.1,position(s),2,true);assert.equal(life.time,clock);assert.ok(actor.position.equals(before));assert.equal(cheers.length,1);
 life.update(.05,position(s),2,false);assert.equal(cheers.length,1);
 life.update(0,{x:90000,z:90000,altitude:30},2,false);assert.equal(built.root.visible,false);
});
test('Prado : trois familles par plage, enfants, merguez, fumée et scènes réutilisées',()=>{
 const life=fixture();
 for(const id of ['prado','prado-sud']){
  const item=definition(id);life.update(0,position(item),4,false);const s=life.scenes.find(scene=>scene.id===id);
  assert.equal(s.grills.length,3);assert.equal(s.cooks.length,3);assert.equal(s.crowd.length,15);assert.equal(s.crowd.filter(p=>p.size<1).length,6);
  assert.ok(s.grills.every(grill=>grill.sausages.length===7&&grill.smoke.count===8));
  life.update(.1,position(item),4,false);const before=Array.from(s.grills[0].smoke.instanceMatrix.array),children=s.root.children.length;
  life.update(.1,position(item),4,true);assert.deepEqual(Array.from(s.grills[0].smoke.instanceMatrix.array),before);
  life.update(.1,position(item),4,false);assert.notDeepEqual(Array.from(s.grills[0].smoke.instanceMatrix.array),before);assert.equal(s.root.children.length,children);
  s.root.traverse(o=>assert.ok(o.position.toArray().every(Number.isFinite)));
 }
});
test('Fumée : dérive bornée avec le mistral et effet réduit stable',()=>{
 for(let t=0;t<40;t+=.1)for(let i=0;i<8;i++){
  const puff=grillSmoke(t,i,12);assert.ok(puff.opacity>=0&&puff.opacity<=.22);assert.ok(puff.y>=1.4&&puff.y<=5.9);assert.ok(Math.abs(puff.x)<1.5);
 }
 assert.equal(grillSmoke(4,2,12,{reducedMotion:true}).x,0);
});
