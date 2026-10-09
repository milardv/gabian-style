import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.core.js';
import {createScooter,stepScooter,interpolateScooter,scooterSurface} from '../public/flight/scooter-physics.js';
import {ScooterCamera} from '../public/flight/scooter-camera.js';
import {createTmax} from '../public/flight/scooter.js';
const simulate=(state,input,seconds,env={})=>{for(let i=0;i<Math.round(seconds*120);i++)stepScooter(state,input,1/120,env);return state;};
const moving=speed=>({...createScooter(),speed});
test('À l’arrêt, tourner le guidon ne fait ni pivoter ni pencher le scooter',()=>{
 const s=simulate(createScooter(),{turn:1},3);assert.equal(s.heading,0);assert.equal(s.lean,0);assert.equal(s.x,0);assert.equal(s.z,0);assert.ok(s.steering>.5);
});
test('Virages symétriques, inclinaison vers l’intérieur et équilibre centrifuge',()=>{
 const a=simulate(moving(15),{turn:1,throttle:.16},5),b=simulate(moving(15),{turn:-1,throttle:.16},5);
 assert.ok(a.heading>0&&a.lean>0);assert.ok(b.heading<0&&b.lean<0);
 assert.ok(Math.abs(a.x+b.x)<1e-8);assert.ok(Math.abs(a.z-b.z)<1e-8);assert.ok(Math.abs(a.heading+b.heading)<1e-8);
 assert.ok(Math.abs(a.lean-Math.atan(a.speed*a.yawRate/9.81))<.02);
});
test('La vitesse élargit le rayon de virage et l’effort latéral reste borné',()=>{
 const low=simulate(moving(6),{turn:1,throttle:.09},3),high=simulate(moving(28),{turn:1,throttle:.37},3);
 assert.ok(high.speed/high.yawRate>low.speed/low.yawRate*4);assert.ok(high.steering<low.steering);
 const state=createScooter();for(let i=0;i<2400;i++){stepScooter(state,{turn:1,throttle:1},1/120);assert.ok(Math.abs(state.speed*state.yawRate)<=9.81*Math.tan(.58)+1e-9);}
});
test('Appui et inversion des touches : braquage et inclinaison continus',()=>{
 const s=moving(18);stepScooter(s,{turn:1},1/120);assert.ok(s.steering<.005);assert.ok(s.lean<.001);
 simulate(s,{turn:1},1);const steering=s.steering,lean=s.lean;
 stepScooter(s,{turn:-1},1/120);assert.ok(Math.abs(s.steering-steering)<.005);assert.ok(Math.abs(s.lean-lean)<.02);
 simulate(s,{turn:0},3);assert.ok(Math.abs(s.lean)<.01);assert.ok(Math.abs(s.yawRate)<.01);
});
test('Aucune correction latérale automatique vers le centre d’une route',()=>{
 const s=simulate(moving(10),{},2,{ground:()=>0,road:()=>({x:50,z:0,width:6,distance:20,y:0})});
 assert.equal(s.x,0);assert.equal(s.heading,0);assert.ok(s.z<0);
});
test('Freinage progressif, pas de marche arrière ni de rotation à l’arrêt',()=>{
 const s=simulate(moving(20),{brake:1,turn:1},5);assert.equal(s.speed,0);assert.equal(s.yawRate,0);
 const heading=s.heading;simulate(s,{brake:1,turn:1},2);assert.equal(s.heading,heading);assert.ok(s.lean<.01);
});
test('Route/terrain et suspension : pas de saut au seuil des données routières',()=>{
 const env=distance=>({ground:()=>0,road:()=>({width:6,distance,y:3})});
 assert.ok(Math.abs(scooterSurface(0,0,0,env(8.99)).height-scooterSurface(0,0,0,env(9.01)).height)<.01);
 const s=createScooter();stepScooter(s,{},1/120,{ground:()=>3});assert.ok(s.altitude<.04);assert.ok(s.verticalVelocity>0);
});
test('Le modèle affiche roue avant, guidon et inclinaison dans le bon sens',()=>{
 const model=createTmax(),s={...createScooter(),lean:.3,steering:.2};model.animate(s,1/60);model.root.updateMatrixWorld(true);
 assert.equal(model.steeringAssembly.rotation.y,-.2);assert.equal(model.handlebar.rotation.y,-.2);
 const up=new T.Vector3(0,1,0).applyQuaternion(model.root.quaternion);assert.ok(up.x>0);
 assert.equal(model.wheels[0].parent,model.steeringAssembly);
});
test('Simulation fixe et interpolation : même trajectoire à 30 et 144 images/s',()=>{
 const render=fps=>{let state=createScooter(),previous={...state},accumulator=0;for(let frame=0;frame<fps*4;frame++){accumulator+=1/fps;while(accumulator>=1/120){previous={...state};stepScooter(state,{throttle:1,turn:.6},1/120);accumulator-=1/120;}}return interpolateScooter(previous,state,accumulator*120);};
 const a=render(30),b=render(144);for(const key of ['x','z','heading','lean','speed'])assert.ok(Math.abs(a[key]-b[key])<.001,key);
});
test('Caméra : horizon stable en poursuite, suivi continu pendant un virage et passage de 2π',()=>{
 const rig=new ScooterCamera(),camera=new T.PerspectiveCamera(),s=moving(15);rig.update(camera,s,false,1/60);
 for(let i=0;i<100;i++){const before=camera.position.clone();stepScooter(s,{turn:1},1/60);rig.update(camera,s,false,1/60);assert.ok(camera.position.distanceTo(before)<1);assert.deepEqual(camera.up.toArray(),[0,1,0]);}
 rig.reset();s.heading=Math.PI*2-.01;rig.update(camera,s,false,1/60);s.heading=.01;rig.update(camera,s,false,1/60);assert.ok(Math.abs(rig.heading-(Math.PI*2-.01))<.01);
});
test('Dérapage : virage plus serré, glisse symétrique et perte de vitesse',()=>{
 const normal=simulate(moving(18),{turn:1,throttle:.3},2);
 const right=simulate(moving(18),{turn:1,throttle:.3,drift:true},2);
 const left=simulate(moving(18),{turn:-1,throttle:.3,drift:true},2);
 assert.ok(right.speed/right.yawRate<normal.speed/normal.yawRate*.6);
 assert.ok(right.heading-right.slipAngle>normal.heading);
 assert.ok(right.slipAngle>.3);assert.ok(right.speed<normal.speed);
 for(const key of ['x','heading','slipAngle','lean'])assert.ok(Math.abs(right[key]+left[key])<1e-8,key);
 assert.ok(Math.abs(right.z-left.z)<1e-8);
});
test('Dérapage : activation et reprise d’adhérence sans saut de pose',()=>{
 const s=simulate(moving(18),{turn:1,throttle:.3},1);
 const before={...s};stepScooter(s,{turn:1,throttle:.3,drift:true},1/120);
 assert.ok(s.drift>0&&s.drift<.06);assert.ok(Math.abs(s.slipAngle-before.slipAngle)<.001);
 simulate(s,{turn:1,throttle:.3,drift:true},1);
 const sliding={...s};stepScooter(s,{turn:1,throttle:.3},1/120);
 assert.ok(s.drift<sliding.drift&&s.drift>.9);
 assert.ok(Math.abs(s.slipAngle-sliding.slipAngle)<.002);
 assert.ok(Math.abs(s.lean-sliding.lean)<.02);
 simulate(s,{turn:1,throttle:.3},3);assert.ok(s.drift<.001);assert.ok(Math.abs(s.slipAngle)<.001);
});
test('Dérapage à l’arrêt : aucune glisse ni rotation',()=>{
 const s=simulate(createScooter(),{turn:1,drift:true},3);
 for(const key of ['x','z','heading','speed','drift','slipAngle'])assert.equal(s[key],0,key);
});
test('Dérapage : trajectoire et interpolation identiques à 30 et 144 images/s',()=>{
 const render=fps=>{let s=moving(18),previous={...s},accumulator=0,tick=0;for(let frame=0;frame<fps*4;frame++){accumulator+=1/fps;while(accumulator>=1/120){previous={...s};stepScooter(s,{throttle:.3,turn:.7,drift:tick++<240},1/120);accumulator-=1/120;}}return interpolateScooter(previous,s,accumulator*120);};
 const a=render(30),b=render(144);for(const key of ['x','z','heading','lean','speed','drift','slipAngle'])assert.ok(Math.abs(a[key]-b[key])<.001,key);
 const previous=createScooter(),current={...previous,drift:1,slipAngle:.4};
 const midpoint=interpolateScooter(previous,current,.5);assert.equal(midpoint.drift,.5);assert.equal(midpoint.slipAngle,.2);
});
test('Nitro scooter : poussée progressive, vitesse accrue et coupure sans saut de vitesse',()=>{
 const normal=simulate(createScooter(),{throttle:1},20),boosted=simulate(createScooter(),{throttle:1,nitro:true},20);
 assert.ok(boosted.speed>normal.speed*1.9);assert.ok(boosted.speed<=70);assert.equal(boosted.airborne,false);
 const speed=boosted.speed;stepScooter(boosted,{throttle:1},1/120);
 assert.ok(boosted.speed>speed-.25);simulate(boosted,{throttle:1},10);assert.ok(boosted.speed<35);
 const stopped=simulate(createScooter(),{nitro:true},3);assert.equal(stopped.speed,0);assert.equal(stopped.nitroPower,0);
});
const bumpGround=(x,z)=>{const distance=-z;return distance>=10&&distance<=30?2*Math.sin((distance-10)*Math.PI/20):0;};
test('Bosse : contact à faible vitesse, décollage rapide et réception amortie',()=>{
 const slow={...createScooter(0,0,.04),speed:4},fast={...createScooter(0,0,.04),speed:35};
 let takeoff=false,landed=false,maxClearance=0;
 for(let i=0;i<1200;i++){
  stepScooter(slow,{throttle:.15},1/120,{ground:bumpGround});assert.equal(slow.airborne,false);
  const was=fast.airborne;stepScooter(fast,{},1/120,{ground:bumpGround});
  if(fast.airborne){takeoff=true;maxClearance=Math.max(maxClearance,fast.altitude-bumpGround(fast.x,fast.z));}
  if(was&&!fast.airborne){landed=true;assert.ok(fast.landingCompression>0);assert.ok(fast.altitude>=bumpGround(fast.x,fast.z));}
 }
 assert.ok(takeoff);assert.ok(landed);assert.ok(maxClearance>1);assert.equal(fast.airborne,false);assert.ok(fast.landingCompression<.001);
});
test('En l’air : gravité, trajectoire conservée et commandes sans traction',()=>{
 const a={...createScooter(0,0,20),speed:40,airborne:true,verticalVelocity:5},b={...a};
 simulate(a,{},.5);simulate(b,{turn:1,throttle:1,brake:1,drift:true,nitro:true},.5);
 assert.ok(Math.abs(a.altitude-(20+5*.5-9.81*.5*.5*.5))<1e-8);
 assert.ok(Math.abs(a.verticalVelocity-(5-9.81*.5))<1e-8);
 for(const key of ['x','z','altitude','speed'])assert.ok(Math.abs(a[key]-b[key])<1e-8,key);
 assert.equal(b.x,0);assert.equal(b.drift,0);assert.equal(b.airborne,true);
});
test('Plat et pente constante : pas de saut artificiel ; relief rechargé : pas d’impulsion',()=>{
 for(const ground of [()=>0,(x,z)=>-z*.1]){
  const s={...createScooter(0,0,.04),speed:60};for(let i=0;i<600;i++){stepScooter(s,{throttle:1,nitro:true},1/120,{ground});assert.equal(s.airborne,false);}
 }
 const s=simulate(moving(30),{},1);stepScooter(s,{},1/120,{ground:()=>4});assert.equal(s.airborne,false);assert.equal(s.groundVelocity,0);
});
test('Saut : hauteur accrue avec la vitesse et animation de réception sans déplacer les roues',()=>{
 const peak=speed=>{const s={...createScooter(0,0,.04),speed};let height=0;for(let i=0;i<1200;i++){stepScooter(s,{nitro:true},1/120,{ground:bumpGround});if(s.airborne)height=Math.max(height,s.altitude-bumpGround(s.x,s.z));}return height;};
 assert.ok(peak(60)>peak(30)*1.5);
 const model=createTmax(),s={...createScooter(),landingCompression:.1};model.animate(s);assert.equal(model.chassis.position.y,-.1);assert.equal(model.steeringAssembly.position.y,.32);assert.equal(model.wheels[0].position.y,0);
});
