import * as T from '../vendor/three/three.module.js';
import {tileAt,toGeo} from './geo.js';
import {buildDivers,updateDivers,buildBeach,updateBeach} from './coastal-scenes.js';
import {LIFE_SCENES,ferryProgress,sardineActive,nearbyReaction,coastalUpdraft} from './life-rules.js';

// Small illustrated scenes. Shared meshes/materials, lazy construction, no extra data service.
export class MarseilleLife {
 constructor(scene,world,notice,{sardineDelay=45+Math.random()*135,reducedMotion=false,celebrate=null}={}){
  this.scene=scene;this.world=world;this.reducedMotion=reducedMotion;this.celebrate=celebrate;this.notice=notice;this.time=0;this.delay=sardineDelay;this.lastSardine=false;this.cryUntil=0;this.replyAt=-10;this.current=null;
  this.scenes=LIFE_SCENES.map(item=>({...item,root:null,animated:[],crowd:[],built:false}));
  this.geometries={box:new T.BoxGeometry(1,1,1),sphere:new T.SphereGeometry(1,10,7),pole:new T.CylinderGeometry(1,1,1,6),canopy:new T.ConeGeometry(1,1,8),body:new T.CapsuleGeometry(.42,1,3,5),head:new T.SphereGeometry(.32,6,5)};
  this.materials=new Map();this.dummy=new T.Object3D();this.world.lifeLandmarks=[];this.geometries.wing=new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,-.12),new T.Vector3(.75,0,.12),new T.Vector3(.2,0,.25)]);this.geometries.wing.computeVertexNormals();
 }
 material(color){if(!this.materials.has(color))this.materials.set(color,new T.MeshLambertMaterial({color,side:T.DoubleSide}));return this.materials.get(color);}
 mesh(parent,shape,color,scale,position=[0,0,0]){const mesh=new T.Mesh(this.geometries[shape],this.material(color));mesh.scale.set(...scale);mesh.position.set(...position);parent.add(mesh);return mesh;}
 parasol(parent,x,z,color){const p=new T.Group();p.position.set(x,0,z);parent.add(p);this.mesh(p,'pole',0xf4eddb,[.10,4.2,.10],[0,2.1,0]);this.mesh(p,'canopy',color,[3.4,1.1,3.4],[0,4.6,0]);return p;}
 person(scene,x,z,index,blue=false){scene.crowd.push({x,z,index,blue});}
 createCrowd(s){
  if(!s.crowd.length)return;
  s.bodies=new T.InstancedMesh(this.geometries.body,this.material(s.id==='supporters'?0x72caff:0xd79061),s.crowd.length);
  s.heads=new T.InstancedMesh(this.geometries.head,this.material(0xd9ad86),s.crowd.length);
  s.arms=new T.InstancedMesh(this.geometries.pole,this.material(0xf5efe0),s.crowd.length*(s.id==='divers'?2:1));s.root.add(s.bodies,s.heads,s.arms);
  const blue=new T.Color(0x2498d9),cream=new T.Color(0xfff8e5),red=new T.Color(0xc76c43);
  for(let i=0;i<s.crowd.length;i++)s.bodies.setColorAt(i,s.crowd[i].blue?blue:i%3?cream:red);
  s.bodies.frustumCulled=s.heads.frustumCulled=s.arms.frustumCulled=false;
 }
 findGround(s){
  if(s.id==='ferry'||s.id==='sardine')return{x:s.x,z:s.z,y:1.8};
  if(s.id==='divers')return{x:s.x,z:s.z,y:Math.max(s.roadHeight,this.world.ground(s.x,s.z))};
  if(s.id==='panier')return{x:s.x,z:s.z,y:this.world.surface(s.x,s.z)+1};
  // When IGN buildings have loaded, locate a clear patch near the intended square.
  for(let ring=0;ring<4;ring++)for(let i=0;i<(ring?12:1);i++){
   const angle=i/12*Math.PI*2,x=s.x+Math.cos(angle)*ring*20,z=s.z+Math.sin(angle)*ring*20,y=this.world.ground(x,z);
   if([[0,0],[4,0],[-4,0],[0,4],[0,-4]].every(([dx,dz])=>this.world.surface(x+dx,z+dz)-this.world.ground(x+dx,z+dz)<2))return{x,z,y};
  }return null;
 }
 build(s){
  const anchor=this.findGround(s);if(!anchor)return;
  s.anchor=anchor;s.root=new T.Group();s.root.position.set(anchor.x,anchor.y,anchor.z);this.scene.add(s.root);s.built=true;
  if(s.id==='ferry')this.buildFerry(s);
  if(s.id==='petanque')this.buildPetanque(s);
  if(s.id==='market')this.buildMarket(s);
  if(s.id==='apero')this.buildApero(s);
  if(s.id==='supporters')this.buildSupporters(s);
  if(s.id==='panier')this.buildPanier(s);
  if(s.id==='sardine')this.buildSardine(s);
  if(s.id==='divers')buildDivers(this,s);
  if(s.id==='prado'||s.id==='prado-sud')buildBeach(this,s);
  if(s.id!=='ferry'&&s.id!=='panier'&&s.id!=='sardine'&&s.id!=='divers'){
   for(const child of s.root.children){const x=anchor.x+child.position.x,z=anchor.z+child.position.z;if(this.world.surface(x,z)-this.world.ground(x,z)>3)child.visible=false;}
   s.crowd=s.crowd.filter(p=>this.world.surface(anchor.x+p.x,anchor.z+p.z)-this.world.ground(anchor.x+p.x,anchor.z+p.z)<3);
  }
  this.createCrowd(s);
 }
 buildFerry(s){
  s.boat=new T.Group();s.root.add(s.boat);
  this.mesh(s.boat,'sphere',0x164bc1,[3.2,1.2,7.5],[0,.7,0]);this.mesh(s.boat,'box',0xfff8e5,[5.3,.5,12],[0,1.7,0]);
  this.mesh(s.boat,'box',0x89d2f5,[4.5,2,6],[0,3,-1]);this.mesh(s.boat,'box',0xfff8e5,[5.2,.35,10],[0,4.2,0]);
  for(const x of [-2.4,2.4])for(const z of [-4,4])this.mesh(s.boat,'pole',0xfff8e5,[.12,2.5,.12],[x,2.8,z]);
  this.mesh(s.boat,'pole',0x164bc1,[.12,3,.12],[0,5.7,1]);s.flag=this.mesh(s.boat,'box',0x89d2f5,[2,1.1,.08],[1,6.5,1]);
  for(let i=0;i<6;i++)this.person(s,(i%3-1)*1.3,(i<3?3.8:-4.6),i,true);
  const points=[new T.Vector3(-3,.2,8),new T.Vector3(-5,.2,19),new T.Vector3(0,.2,13),new T.Vector3(5,.2,19),new T.Vector3(3,.2,8)];s.wake=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xfff8e5,transparent:true,opacity:.5}));s.boat.add(s.wake);
 }
 buildPetanque(s){
  this.mesh(s.root,'box',0xd7bf91,[18,.16,30],[0,0,0]);
  for(const x of [-13,13]){this.mesh(s.root,'pole',0x886b48,[.8,10,.8],[x,5,0]);this.mesh(s.root,'sphere',0x7b9b62,[7,4,8],[x,11,0]);}
  for(let i=0;i<8;i++)this.person(s,(i%2?1:-1)*7,(i%4-1.5)*7,i);
  s.boule=this.mesh(s.root,'sphere',0xa9afb4,[.28,.28,.28],[-5,.35,-10]);this.mesh(s.root,'sphere',0xee550f,[.12,.12,.12],[1,.3,4]);
  for(let i=0;i<5;i++)this.mesh(s.root,'sphere',0xabb3ba,[.28,.28,.28],[Math.sin(i*2)*2,.35,3+Math.cos(i*3)*2]);
 }
 buildMarket(s){
  for(let i=0;i<6;i++){
   const x=(i%2?1:-1)*6,z=(Math.floor(i/2)-1)*9;this.parasol(s.root,x,z,[0xee550f,0xffe797,0x89d2f5][i%3]);
   this.mesh(s.root,'box',0x8e6e4c,[5,1,2.4],[x,.7,z]);
   for(let j=0;j<9;j++)this.mesh(s.root,'sphere',[0xf2b640,0xc76b36,0x6f9c50][j%3],[.35,.3,.35],[x+(j%3-1)*1.3,1.5,z+(Math.floor(j/3)-1)*.6]);
   this.person(s,x,z+2,i);this.person(s,x*.45,z-2,i+6,true);
  }
 }
 buildApero(s){
  for(let i=0;i<3;i++){
   const x=(i-1)*11,z=i%2*5;this.parasol(s.root,x,z,i%2?0xee550f:0xffe797);
   this.mesh(s.root,'pole',0x886b48,[.25,1.6,.25],[x,.8,z]);this.mesh(s.root,'sphere',0xfff8e5,[2,.2,2],[x,1.7,z]);
   for(let j=0;j<4;j++){const angle=j*Math.PI/2;this.person(s,x+Math.sin(angle)*3,z+Math.cos(angle)*3,i*4+j);this.mesh(s.root,'pole',0xffe797,[.14,.4,.14],[x+Math.sin(angle),2,z+Math.cos(angle)]);}
  }
 }
 buildSupporters(s){
  for(let i=0;i<32;i++)this.person(s,(i%4-1.5)*3,(Math.floor(i/4)-3.5)*4,i,i%2===0);
  for(let i=0;i<7;i++){
   const root=new T.Group();root.position.set((i%2?1:-1)*7,0,(i-3)*6);s.root.add(root);this.mesh(root,'pole',0xfff8e5,[.12,6,.12],[0,3,0]);
   const flag=this.mesh(root,'box',i%2?0xfff8e5:0x43b9ef,[3.8,2.1,.07],[1.8,5.2,0]);s.animated.push(flag);
  }
 }
 buildPanier(s){
  for(const x of [-9,9])this.mesh(s.root,'pole',0x886b48,[.15,5,.15],[x,2.5,0]);
  s.root.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-9,4.7,0),new T.Vector3(0,4.2,0),new T.Vector3(9,4.7,0)]),new T.LineBasicMaterial({color:0xfff8e5})));
  for(let i=0;i<7;i++){const cloth=this.mesh(s.root,'box',[0xfff8e5,0x89d2f5,0xff8db8,0xffe797][i%4],[1.6,2.2,.06],[(i-3)*2.3,3.25,0]);s.animated.push(cloth);}
  s.gulls=Array.from({length:3},(_,i)=>{const bird=this.rivalBird();bird.root.scale.setScalar(2.3);this.scene.add(bird.root);return{bird,phase:i*2.1};});
 }
 rivalBird(){
  const root=new T.Group();this.mesh(root,'sphere',0xfff8e5,[.16,.2,.4]);this.mesh(root,'sphere',0xfff8e5,[.11,.12,.14],[0,.1,-.43]);
  const beak=this.mesh(root,'canopy',0xffe797,[.05,.18,.05],[0,.08,-.6]);beak.rotation.x=-Math.PI/2;
  const wings=[-1,1].map(side=>{const wing=new T.Mesh(this.geometries.wing,this.material(0xadb8c0));wing.scale.x=side;wing.position.set(side*.1,.08,0);root.add(wing);return{wing,side};});
  return{root,animate(s){root.position.set(s.x,s.altitude,s.z);root.rotation.set(s.pitch,-s.heading,-s.roll,'YXZ');for(const {wing,side}of wings)wing.rotation.z=side*Math.sin(s.time*9)*.45;}};
 }
 buildSardine(s){
  s.fish=new T.Group();s.root.add(s.fish);this.mesh(s.fish,'sphere',0x89d2f5,[5,4,24],[0,5,0]);this.mesh(s.fish,'sphere',0x164bc1,[4.3,1.3,21],[0,8,0]);
  for(const side of [-1,1]){this.mesh(s.fish,'sphere',0xfff8e5,[.16,1.3,1.3],[side*4,6,-16]);this.mesh(s.fish,'sphere',0x123471,[.2,.6,.6],[side*4.12,6,-16]);}
  const tail=new T.Mesh(new T.ConeGeometry(8,13,3),this.material(0x164bc1));tail.rotation.x=Math.PI/2;tail.position.set(0,5,25);s.fish.add(tail);
  this.mesh(s.fish,'canopy',0x164bc1,[2,5,7],[0,10,3]);
 }
 updateCrowd(s,t,reacting){
  if(!s.bodies)return;
  for(let i=0;i<s.crowd.length;i++){
   const p=s.crowd[i],march=s.id==='supporters'?((p.z+t*1.4+32)%64)-32-p.z:0;let bob=s.id==='supporters'?Math.abs(Math.sin(t*3+p.index))*.2:0;
   const size=p.size??1,x=p.x,z=p.z+march,base=(s.id==='ferry'?2:0)-(p.seated?.6:0)+(s.grills?this.world.ground(s.anchor.x+x,s.anchor.z+z)-s.root.position.y:0);if(p.size&&size<1&&s.grills&&!this.reducedMotion){bob+=Math.abs(Math.sin(t*2+p.index))*.08;}
   this.dummy.position.set(x,base+1.2*size+bob,z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(size,size,size);this.dummy.updateMatrix();s.bodies.setMatrixAt(i,this.dummy.matrix);
   this.dummy.position.y=base+2.4*size+bob;this.dummy.updateMatrix();s.heads.setMatrixAt(i,this.dummy.matrix);
   const arms=s.id==='divers'?2:1;for(let side=0;side<arms;side++){const sign=side?-1:1;this.dummy.position.set(x+sign*.55*size,base+1.8*size+bob+(reacting?.4:0),z);this.dummy.rotation.z=sign*(reacting?-.5+(this.reducedMotion?0:Math.sin(t*9+i)*.5):1.1);this.dummy.scale.set(.13*size,size,.13*size);this.dummy.updateMatrix();s.arms.setMatrixAt(i*arms+side,this.dummy.matrix);}
  }
  for(const mesh of [s.bodies,s.heads,s.arms])mesh.instanceMatrix.needsUpdate=true;
 }
 update(dt,position,wind,paused){
  if(!paused)this.time+=Math.min(dt,.1);const t=this.time,sardine=sardineActive(t,this.delay);this.position=position;this.wind=wind;
  const landmarks=[];
  for(const s of this.scenes){
   const distance=Math.hypot(position.x-s.x,position.z-s.z),active=s.id!=='sardine'||sardine;
   const water=s.id==='ferry'||s.id==='sardine',tile=this.world.tiles?.get(tileAt(...toGeo(s.x,s.z)).join('/')),ready=water||!this.world.tiles||!!tile?.buildings;
   if(active&&distance<650&&!ready&&!s.loading&&t>=(s.retryAt||0)){
    s.loading=true;this.world.prime(s.x,s.z).catch(()=>{s.retryAt=this.time+30;}).finally(()=>{s.loading=false;});
   }
   if(active&&distance<1500&&!s.built&&ready&&t>=(s.buildAt||0)){s.buildAt=t+2;this.build(s);}
   if(!s.built)continue;s.root.visible=active&&distance<1800;
   if(s.gulls)for(const {bird}of s.gulls)bird.root.visible=s.root.visible&&distance<550;
   if(!s.root.visible)continue;
   let reacting=this.current===s.id&&t<this.cryUntil;
   if(s.id!=='ferry'&&s.id!=='sardine')s.root.position.y=s.id==='panier'?this.world.surface(s.anchor.x,s.anchor.z)+1:s.id==='divers'?Math.max(s.roadHeight,this.world.ground(s.anchor.x,s.anchor.z)):this.world.ground(s.anchor.x,s.anchor.z);
   const height=s.root.position.y;
   landmarks.push({...s,x:s.anchor.x,z:s.anchor.z,center:[s.anchor.x,s.anchor.z],height:height+6,ground:this.world.ground(s.anchor.x,s.anchor.z)});
   if(s.id==='ferry'){
    const progress=ferryProgress(t);s.boat.position.set(0,Math.sin(t)*.1,(progress-.5)*180);s.boat.rotation.y=t%160<85?0:Math.PI;
    s.wake.visible=t%160>=15&&t%160<75||t%160>=95&&t%160<155;s.flag.rotation.y=Math.sin(t*2)*.25;
    // Passengers share the boat's movement and turn.
    for(const mesh of [s.bodies,s.heads,s.arms]){mesh.position.copy(s.boat.position);mesh.rotation.y=s.boat.rotation.y;}
   }
   if(s.boule){const u=(t%12)/12;s.boule.position.set(-5+u*7,.35+Math.sin(Math.min(u*2,1)*Math.PI)*1.5,-10+u*15);}
   for(let i=0;i<s.animated.length;i++)s.animated[i].rotation.y=Math.sin(t*(1+wind*.08)+i)*Math.min(.65,.12+wind*.035);
   if(s.gulls&&distance<550)for(const {bird,phase}of s.gulls){const angle=t*.4+phase,follow=reacting?position:null,x=follow?follow.x+Math.sin(angle)*9:s.anchor.x+Math.sin(angle)*19,z=follow?follow.z+Math.cos(angle)*9:s.anchor.z+Math.cos(angle)*19,altitude=follow?follow.altitude+3:height+10+Math.sin(t+phase)*2;const followRate=1-Math.exp(-2*(paused?0:Math.min(dt,.1))),px=bird.root.position.x,pz=bird.root.position.z,py=bird.root.position.y,initialized=bird.root.userData.placed;bird.animate({x:initialized?px+(x-px)*followRate:x,z:initialized?pz+(z-pz)*followRate:z,altitude:initialized?py+(altitude-py)*followRate:altitude,heading:angle+Math.PI/2,pitch:0,roll:reacting ? .2 : 0,flap:.7,time:t+phase});bird.root.userData.placed=true;}
   if(s.fish){s.fish.position.y=Math.sin(t*.8)*.6;s.fish.rotation.z=Math.sin(t*.5)*.07;}
   if(s.divers)reacting=updateDivers(this,s,t,distance<220&&!paused)||reacting;
   if(s.grills)updateBeach(this,s,t,wind);
   this.updateCrowd(s,t,reacting);
  }
  this.world.lifeLandmarks=landmarks;
  if(sardine&&!this.lastSardine&&Math.hypot(position.x-this.scenes.find(s=>s.id==='sardine').x,position.z-this.scenes.find(s=>s.id==='sardine').z)<1500)this.notice('Oh fan ! Une sardine géante bouche le Vieux-Port.');
  this.lastSardine=sardine;
 }
 react(position){
  if(this.time-this.replyAt<3)return null;
  const scene=nearbyReaction(position,this.world.lifeLandmarks,sardineActive(this.time,this.delay));if(!scene)return null;
  this.current=scene.id;this.cryUntil=this.time+7;this.replyAt=this.time;this.notice(scene.reply);return scene.id;
 }
 updraft(position,wind){const height=position.altitude-this.world.ground(position.x,position.z);return coastalUpdraft(position,wind)*Math.max(0,1-height/280);}
}
