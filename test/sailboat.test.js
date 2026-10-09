import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.core.js';
import {createSailboat,stepSailboat,sailingPolar,waveHeight,interpolateSailboat,WIND_DIRECTION} from '../public/flight/sailboat-physics.js';
import {createSailboatModel} from '../public/flight/sailboat.js';
import {SailboatCamera} from '../public/flight/sailboat-camera.js';
function run(s,seconds,input={},wind=8){for(let i=0;i<seconds*120;i++)stepSailboat(s,input,1/120,{wind});return s;}
test('Voilier : calme plat immobile, pas de propulsion face au vent',()=>{
 const calm=run(createSailboat(),20,{},0);assert.equal(calm.speed,0);assert.equal(calm.heel,0);assert.equal(calm.altitude,.35);
 const headwind=run(createSailboat(0,0,WIND_DIRECTION+Math.PI),20);assert.equal(headwind.speed,0);
 assert.equal(sailingPolar(39*Math.PI/180),0);assert.ok(sailingPolar(60*Math.PI/180)>0);
});
test('Voilier : trim efficace, inertie et résistance limitent la vitesse',()=>{
 const ideal=createSailboat(0,0,Math.PI/2),slack=createSailboat(0,0,Math.PI/2);ideal.trim=.8;slack.trim=.05;run(ideal,30);run(slack,30);
 assert.ok(ideal.speed>.8&&ideal.speed<4);assert.ok(ideal.speed>slack.speed*1.2);
 const before=ideal.speed;stepSailboat(ideal,{},1/120,{wind:0});assert.ok(ideal.speed>before*.95);run(ideal,40,{},0);assert.ok(ideal.speed<before*.05);
 const strong=run(createSailboat(0,0,Math.PI/2),90,{},12);assert.ok(strong.speed<6);
});
test('Voilier : barre progressive, pas de pivot sur place et gîte continue au virement',()=>{
 const stopped=run(createSailboat(),5,{turn:1},0);assert.equal(stopped.heading,0);
 const s=run(createSailboat(0,0,Math.PI/2),20),heading=s.heading,heel=s.heel,boom=s.boom;
 stepSailboat(s,{turn:1},1/120,{wind:8});assert.ok(Math.abs(s.heading-heading)<.001);assert.ok(Math.abs(s.heel-heel)<.005);
 run(s,2,{turn:1});assert.ok(s.heading>heading+.05);assert.ok(Math.abs(s.boom-boom)<2.5);
 for(let i=0;i<4000;i++){const old=s.boom;stepSailboat(s,{turn:-1},1/120,{wind:12});assert.ok(Math.abs(s.boom-old)<.025);assert.ok(Math.abs(s.heel)<.5);}
});
test('Voilier : empreinte de coque empêche la proue de traverser la côte, arrêt figé',()=>{
 const s=createSailboat(0,0,Math.PI/2);s.vx=s.speed=3;
 stepSailboat(s,{},1/120,{wind:8,isWater:x=>x<2});assert.equal(s.grounded,true);assert.equal(s.speed,0);assert.equal(s.x,0);
 const frozen={...s};stepSailboat(s,{turn:1},.1,{wind:8});assert.deepEqual(s,frozen);
});
test('Voilier : interpolation courte autour du nord et mouvement indépendant du rendu',()=>{
 const a=createSailboat();a.heading=Math.PI*2-.01;const b={...a,heading:.01};assert.ok(Math.abs(interpolateSailboat(a,b,.5).heading-Math.PI*2)<1e-8);
 function frames(fps){const s=createSailboat(0,0,Math.PI/2);let accumulator=0;for(let frame=0;frame<fps*10;frame++){accumulator+=1/fps;while(accumulator>=1/120-1e-10){stepSailboat(s,{turn:.2},1/120,{wind:8});accumulator-=1/120;}}return s;}
 assert.deepEqual(frames(30),frames(120));assert.equal(waveHeight(3,4,1,0),.35);
});
test('Voilier : voile attachée, pause stable, sillage fini et conservé dans le monde au virage',()=>{
 const scene=new T.Scene(),boat=createSailboatModel(scene),s=run(createSailboat(0,0,Math.PI/2),20);
 boat.animate(s,.1,8);const cloth=[];boat.root.traverse(o=>{if(o.geometry?.attributes.position.count===169)cloth.push(o.geometry.attributes.position);});assert.equal(cloth.length,2);
 for(const p of cloth)for(let i=0;i<p.count;i+=13)assert.equal(p.getX(i),0);
 for(let i=0;i<150;i++){run(s,.2);boat.animate(s,.2,8);}
 const wake=scene.children.find(o=>o.isLineSegments);assert.ok(wake.geometry.drawRange.count>0);assert.ok(wake.geometry.drawRange.count<=240*2);
 const vertices=Array.from(wake.geometry.attributes.position.array),pos=boat.root.position.clone();boat.animate(s,0,8);assert.deepEqual(Array.from(wake.geometry.attributes.position.array),vertices);assert.ok(boat.root.position.equals(pos));
 const old=vertices.slice(0,6);s.heading+=.5;boat.animate(s,0,8);assert.deepEqual(Array.from(wake.geometry.attributes.position.array).slice(0,6),old);
 boat.setVisible(false);assert.equal(wake.visible,false);boat.reset();s.time=0;boat.animate(s,0,8);assert.equal(wake.geometry.drawRange.count,0);
});
test('Voilier : caméra douce au changement de cap, horizon stable en vue arrière',()=>{
 const c=new SailboatCamera(),camera=new T.PerspectiveCamera(),s=createSailboat();c.update(camera,s,false,1/60);const before=camera.position.clone();s.heading=.4;s.heel=.3;c.update(camera,s,false,1/60);
 assert.ok(camera.position.distanceTo(before)<.1);assert.equal(camera.up.x,0);assert.equal(camera.up.z,0);
 c.update(camera,s,true,1/60);assert.ok(camera.position.y>s.altitude+1);assert.ok(camera.up.length()>.99);
});

test('Voilier : tête de foc ancrée au mât et équipier progressif lors du changement de bord',()=>{
 const scene=new T.Scene(),boat=createSailboatModel(scene),s=run(createSailboat(0,0,Math.PI/2),20);boat.animate(s,1/60,8);
 const crew=boat.root.children.find(o=>o.isGroup&&o.children.some(m=>m.geometry?.type==='SphereGeometry'));const before=crew.position.x;
 const jib=boat.root.children.find(o=>o.isGroup&&o.position.z===-2.9).children[0];
 boat.root.updateMatrixWorld(true);const head=new T.Vector3().fromBufferAttribute(jib.geometry.attributes.position,156);jib.localToWorld(head);
 s.time+=1/60;s.windAngle=-s.windAngle;s.boom=-s.boom;boat.animate(s,1/60,8);boat.root.updateMatrixWorld(true);const after=new T.Vector3().fromBufferAttribute(jib.geometry.attributes.position,156);jib.localToWorld(after);
 assert.ok(head.distanceTo(after)<1e-8);assert.ok(Math.abs(crew.position.x-before)<.08);
});

test('Voilier : les vagues laissent les images aériennes visibles et gardent les tests de profondeur',()=>{
 const scene=new T.Scene();createSailboatModel(scene);
 const water=scene.children.find(o=>o.geometry?.attributes.color?.itemSize===4);
 assert.ok(water.material.transparent);assert.ok(water.material.opacity<=.08);
 assert.equal(water.material.depthTest,true);assert.equal(water.material.depthWrite,false);
});
