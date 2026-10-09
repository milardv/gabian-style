import * as T from '../vendor/three/three.module.js';
import {toLocal} from './geo.js';
import {divePose,grillSmoke} from './coastal-motion.js';

function figure(life,parent,color,scale=1){
 const root=new T.Group();parent.add(root);root.scale.setScalar(scale);
 life.mesh(root,'sphere',0xd9ad86,[.28,.3,.28],[0,.75,0]);
 life.mesh(root,'body',color,[.72,.62,.65],[0,0,0]);
 life.mesh(root,'box',0x164bc1,[.62,.3,.48],[0,-.45,0]);
 const arms=[-1,1].map(side=>{const pivot=new T.Group();pivot.position.set(side*.36,.26,0);root.add(pivot);life.mesh(pivot,'pole',0xd9ad86,[.13,.64,.13],[0,-.32,0]);return pivot;});
 const legs=[-1,1].map(side=>{const pivot=new T.Group();pivot.position.set(side*.18,-.5,0);root.add(pivot);life.mesh(pivot,'pole',0xd9ad86,[.16,.68,.16],[0,-.34,0]);return pivot;});
 return{root,arms,legs};
}
export function buildDivers(life,s){
 const [wx,wz]=toLocal(...s.waterCoordinates),dx=wx-s.anchor.x,dz=wz-s.anchor.z;
 s.diveDistance=Math.hypot(dx,dz);s.diveDirection=[dx/s.diveDistance,dz/s.diveDistance];s.diveHeading=Math.atan2(dx,dz);
 s.divers=Array.from({length:3},(_,i)=>{const actor=figure(life,s.root,[0xee550f,0x43b9ef,0xffe797][i]);actor.lastCheering=false;return actor;});
 // Friends stand along the pavement, away from the traffic lane.
 for(let i=0;i<8;i++){
  const along=(i-3.5)*1.9;life.person(s,-s.diveDirection[1]*along,s.diveDirection[0]*along+1.5,i,i%2===0);
 }
 const drops=new T.InstancedMesh(life.geometries.sphere,life.material(0xd7f5ff),18);drops.frustumCulled=false;s.root.add(drops);s.splashDrops=drops;
 s.ripples=Array.from({length:2},()=>{const material=new T.MeshBasicMaterial({color:0xe1f8ff,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide});const ring=new T.Mesh(new T.RingGeometry(.85,1,24),material);ring.rotation.x=-Math.PI/2;s.root.add(ring);return ring;});
}
export function updateDivers(life,s,time,near){
 const [dx,dz]=s.diveDirection,water=-.8,height=s.root.position.y+1.05-water;
 let splash=-1,cheering=false;
 s.divers.forEach((actor,i)=>{
  const pose=divePose(time,i,height,s.diveDistance,{reducedMotion:life.reducedMotion});
  actor.root.visible=pose.visible;actor.root.position.set(dx*pose.forward-dz*(i-1)*1.2,pose.y+water-s.root.position.y,dz*pose.forward+dx*(i-1)*1.2);
  actor.root.rotation.set(pose.spin,s.diveHeading,0,'YXZ');
  actor.arms.forEach((arm,side)=>{arm.rotation.z=(side?1:-1)*(pose.phase==='dive'?2.5-pose.tuck*1.6:.2);arm.rotation.x=pose.phase==='run'?Math.sin(time*9+i+side*Math.PI)*.5:pose.phase==='swim'?Math.sin(time*3+side*Math.PI)*.65:0;});
  actor.legs.forEach((leg,side)=>leg.rotation.x=pose.phase==='dive'?pose.tuck*1.9:pose.phase==='run'?Math.sin(time*9+i+side*Math.PI)*.6:0);
  if(pose.cheering&&!actor.lastCheering&&near&&life.celebrate)life.celebrate('divers');
  actor.lastCheering=pose.cheering;cheering ||=pose.cheering;if(pose.splash>=0)splash=pose.splash;
 });
 s.splashDrops.visible=splash>=0;
 if(splash>=0){
  for(let i=0;i<18;i++){const angle=i/18*Math.PI*2,radius=.6+splash*3,height=Math.max(0,Math.sin(splash*Math.PI)*(1+i%3*.35));life.dummy.position.set(dx*s.diveDistance+Math.cos(angle)*radius,-s.root.position.y-.7+height,dz*s.diveDistance+Math.sin(angle)*radius);life.dummy.scale.setScalar(.08+(1-splash)*.12);life.dummy.rotation.set(0,0,0);life.dummy.updateMatrix();s.splashDrops.setMatrixAt(i,life.dummy.matrix);}s.splashDrops.instanceMatrix.needsUpdate=true;
 }
 s.ripples.forEach((ring,i)=>{ring.visible=splash>=0;if(splash>=0){ring.position.set(dx*s.diveDistance,-s.root.position.y-.75,dz*s.diveDistance);ring.scale.setScalar(1+splash*(4+i*2));ring.material.opacity=(1-splash)*.5;}});
 return cheering;
}
// Adult beachgoers in a relaxed, ordinary sunbathing pose.
function sunbather(life,parent,index){
 const root=new T.Group();root.userData={role:'adult-sunbather',age:28+index*7};
 root.position.set(7,.25,-.5);root.rotation.y=(index-1)*.18;parent.add(root);
 const skin=[0xe2b895,0xb87d55,0xd09b75][index],bottom=[0x164bc1,0xee550f,0x43b9ef][index];
 life.mesh(parent,'box',[0xffe797,0xfff8e5,0x89d2f5][index],[1.8,.04,2.8],[7,.1,-.5]).rotation.y=root.rotation.y;
 life.mesh(root,'sphere',skin,[.30,.16,.48],[0,0,-.08]);
 for(const side of [-1,1]){
  life.mesh(root,'sphere',skin,[.12,.10,.14],[side*.13,.13,-.28]);
  const arm=life.mesh(root,'pole',skin,[.10,.64,.10],[side*.4,.02,-.15]);arm.rotation.x=Math.PI/2;arm.rotation.z=side*.2;
  const leg=life.mesh(root,'pole',skin,[.15,.76,.15],[side*.17,-.02,.86]);leg.rotation.x=Math.PI/2;
 }
 life.mesh(root,'sphere',bottom,[.29,.13,.23],[0,0,.38]);
 life.mesh(root,'sphere',skin,[.22,.21,.23],[0,.06,-.73]);
 life.mesh(root,'sphere',[0x78523c,0x34302d,0xbaa16b][index],[.23,.15,.18],[0,.02,-.87]);
 life.mesh(root,'box',0x23394a,[.34,.04,.10],[0,.27,-.74]);
 life.mesh(parent,'sphere',0xe8c587,[.4,.07,.4],[7.7,.18,-1.3]);
 life.mesh(parent,'canopy',0xe8c587,[.24,.22,.24],[7.7,.27,-1.3]);
 return root;
}
export function buildBeach(life,s){
 s.grills=[];s.cooks=[];s.sunbathers=[];
 for(let family=0;family<3;family++){
  const x=(family-1)*3,z=(family-1)*16,root=new T.Group();root.position.set(x,0,z);s.root.add(root);
  life.parasol(root,4,0,[0xffe797,0x43b9ef,0xee550f][family]);
  const towel=life.mesh(root,'box',[0x43b9ef,0xee550f,0xffe797][family],[4,.06,6],[4,.08,0]);towel.rotation.y=family*.2;
  life.mesh(root,'box',0xfff8e5,[1.5,1,1.1],[5,.6,4]);life.mesh(root,'box',0x164bc1,[1.6,.16,1.2],[5,1.15,4]);
  life.mesh(root,'sphere',0x42464c,[1.15,.4,.8],[-2,1.1,0]);
  for(const side of [-1,1])life.mesh(root,'pole',0x40434a,[.09,1,.09],[-2+side*.7,.5,0]);
  for(let i=0;i<5;i++)life.mesh(root,'box',0x687078,[2,.04,.05],[-2,1.42,(i-2)*.28]);
  life.mesh(root,'sphere',0xee550f,[.8,.11,.5],[-2,1.28,0]);
  const sausages=[];for(let i=0;i<7;i++){const sausage=life.mesh(root,'pole',i%2?0xa63c23:0xce552b,[.10,.65,.10],[-2+(i%4-1.5)*.35,1.5,(i<4?-.2:.25)]);sausage.rotation.z=Math.PI/2;sausages.push(sausage);}
  life.mesh(root,'box',0xf3ecd6,[1.4,.12,.8],[-.7,.85,2]);life.mesh(root,'pole',0xe5ba75,[.11,1.2,.11],[-.7,1,2]).rotation.z=Math.PI/2;
  const cook=figure(life,root,[0xfff8e5,0x43b9ef,0xd79061][family]);cook.root.position.set(-2,1.05,1.6);cook.root.rotation.y=Math.PI;
  const spatula=life.mesh(cook.arms[0],'pole',0x838c96,[.05,.6,.05],[0,-.9,0]);life.mesh(spatula,'box',0xaeb6bb,[3,.35,2],[0,-.55,0]);s.cooks.push(cook);
  for(let i=0;i<5;i++){life.person(s,x+2+(i%3)*1.8,z-3+Math.floor(i/3)*4,family*5+i,i%2===0);const person=s.crowd.at(-1);person.size=i<2?.65:1;person.seated=i>=2;}
  s.sunbathers.push(sunbather(life,root,family));
  const material=new T.MeshLambertMaterial({color:0xe4ddd1,transparent:true,opacity:.2,depthWrite:false});
  const smoke=new T.InstancedMesh(life.geometries.sphere,material,8);smoke.frustumCulled=false;root.add(smoke);
  // Puffs shrink at birth/exit; one shared translucent material keeps draw calls low.
  s.grills.push({root,smoke,sausages,family});
 }
}
export function updateBeach(life,s,time,wind){
 for(const grill of s.grills){
  grill.root.position.y=life.world.ground(s.anchor.x+grill.root.position.x,s.anchor.z+grill.root.position.z)-s.root.position.y;
  for(let i=0;i<8;i++){const puff=grillSmoke(time+grill.family*3,i,wind,{reducedMotion:life.reducedMotion});life.dummy.position.set(-2+puff.x,puff.y,puff.z);life.dummy.scale.setScalar(puff.scale*Math.sin(puff.age*Math.PI));life.dummy.rotation.set(0,0,0);life.dummy.updateMatrix();grill.smoke.setMatrixAt(i,life.dummy.matrix);}grill.smoke.instanceMatrix.needsUpdate=true;
  for(let i=0;i<grill.sausages.length;i++)grill.sausages[i].rotation.x=life.reducedMotion?0:Math.sin(time*.5+grill.family+i*.3)*.25;
 }
 s.cooks.forEach((cook,i)=>{cook.arms[0].rotation.x=-1.1+(life.reducedMotion?0:Math.sin(time*.8+i)*.25);cook.arms[1].rotation.z=.15;});
}
