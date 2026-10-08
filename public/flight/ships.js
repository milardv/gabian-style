import * as T from '../vendor/three/three.module.js';
import {toLocal} from './geo.js';
const box=new T.BoxGeometry(1,1,1);
function cargoShip(scene,{position,heading=0,scale=1,phase=0}){
 const root=new T.Group(),[x,z]=toLocal(...position);root.position.set(x,0,z);root.rotation.y=-heading;root.scale.setScalar(scale);scene.add(root);
 const hull=new T.Mesh(new T.SphereGeometry(1,24,12),new T.MeshStandardMaterial({color:0x172b40,roughness:.38,metalness:.4}));hull.scale.set(14,5.5,82);hull.position.y=5;root.add(hull);
 const waterline=new T.Mesh(new T.SphereGeometry(1,20,10),new T.MeshStandardMaterial({color:0x8b4133,roughness:.7}));waterline.scale.set(13.3,2.8,77);waterline.position.y=2.9;root.add(waterline);
 const decks=new T.Group();root.add(decks);const palette=[0x183d63,0x245983,0x8d3830,0xe3ddd0,0x34566b,0xa65a3e,0xd6d1bd].map(color=>new T.MeshStandardMaterial({color,roughness:.73}));
 const containers=palette.map(material=>{const inst=new T.InstancedMesh(box,material,72);inst.count=0;decks.add(inst);return inst;}),dummy=new T.Object3D();let idx=0;
 for(let row=0;row<12;row++)for(let col=-2;col<=2;col++){if(Math.abs(col)===2&&row>8)continue;const stack=2+((row*7+col*3+28)%4);for(let level=0;level<stack;level++){dummy.position.set(col*5.5,9+level*2.55,-61+row*11);dummy.rotation.set(0,0,0);dummy.scale.set(11,2.45,2.4);dummy.updateMatrix();const inst=containers[(row*3+level*5+Math.abs(col))%containers.length];inst.setMatrixAt(inst.count++,dummy.matrix);idx++;}}for(const inst of containers){inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();}
 const bridgeMat=new T.MeshStandardMaterial({color:0xf1eee4,roughness:.72});const bridge=new T.Mesh(box,bridgeMat);bridge.scale.set(11,15,12);bridge.position.set(0,15,66);root.add(bridge);
 for(let floor=0;floor<4;floor++){const win=new T.Mesh(box,new T.MeshStandardMaterial({color:0x477083,metalness:.25,roughness:.25}));win.scale.set(11.2,.25,10);win.position.set(0,11+floor*2.6,59);root.add(win);}
 const mastMat=new T.MeshStandardMaterial({color:0xe2e5e2,metalness:.45,roughness:.4});for(const m of [-1,1]){const crane=new T.Group();crane.position.set(m*11,18,-45);root.add(crane);const tower=new T.Mesh(box,mastMat);tower.scale.set(.8,19,.8);tower.position.y=9.5;crane.add(tower);const jib=new T.Mesh(box,mastMat);jib.scale.set(1,1,20);jib.position.set(0,18,2);crane.add(jib);const brace=new T.Mesh(box,mastMat);brace.scale.set(.6,13,.6);brace.rotation.x=.7;brace.position.set(0,15,-5);crane.add(brace);}
 const label=document.createElement('canvas');label.width=512;label.height=96;const ctx=label.getContext('2d');ctx.fillStyle='#f4f3ef';ctx.fillRect(0,0,label.width,label.height);ctx.fillStyle='#143a69';ctx.font='700 61px Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('CMA CGM',256,49);ctx.fillStyle='#dd4138';ctx.fillRect(24,79,42,7);const texture=new T.CanvasTexture(label);texture.colorSpace=T.SRGBColorSpace;for(const side of [-1,1]){const sign=new T.Mesh(new T.PlaneGeometry(28,5.2),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));sign.rotation.y=side*Math.PI/2;sign.position.set(side*14.1,9,15);root.add(sign);}
 const wakePoints=Array.from({length:12},(_,i)=>new T.Vector3(0,.35,-82-i*13));const wakeGeo=new T.BufferGeometry().setFromPoints(wakePoints);const wake=new T.Line(wakeGeo,new T.LineBasicMaterial({color:0xe4e8e4,transparent:true,opacity:.34}));root.add(wake);
 return{update(t){root.position.y=.4+Math.sin(t*.48+phase)*.42;root.rotation.z=Math.sin(t*.33+phase)*.006;root.rotation.x=Math.cos(t*.31+phase)*.004;}};
}
function sailboat(scene,{position,heading=0,phase=0,scale=1,seaLevel=0}){
 const root=new T.Group(),[x,z]=toLocal(...position);root.position.set(x,seaLevel,z);root.rotation.y=-heading;root.scale.setScalar(scale);scene.add(root);
 const hull=new T.Mesh(new T.SphereGeometry(1,18,9),new T.MeshStandardMaterial({color:phase%2?0x315264:0x943f34,roughness:.4,metalness:.18}));hull.scale.set(2.1,1,9.8);hull.position.y=1.4;root.add(hull);
 const deck=new T.Mesh(box,new T.MeshStandardMaterial({color:0xf2eee4,roughness:.8}));deck.scale.set(3.1,.25,8);deck.position.y=2.1;root.add(deck);
 const mast=new T.Mesh(new T.CylinderGeometry(.11,.18,17,8),new T.MeshStandardMaterial({color:0x453f36,roughness:.8}));mast.position.set(0,10.5,-.3);root.add(mast);
 const sails=new T.Group();root.add(sails);const sailmat=new T.MeshStandardMaterial({color:phase%2?0xf7f2e4:0xf0ead9,side:T.DoubleSide,roughness:.88});const shape1=new T.BufferGeometry();shape1.setAttribute('position',new T.Float32BufferAttribute([-0.2,2.9,-.1, -.2,15.3,-.1, -.2,4.3,-5.6],3));shape1.setIndex([0,1,2]);shape1.computeVertexNormals();sails.add(new T.Mesh(shape1,sailmat));const shape2=new T.BufferGeometry();shape2.setAttribute('position',new T.Float32BufferAttribute([.22,2.8,.1,.22,13,.1,.22,3.2,5],3));shape2.setIndex([0,1,2]);shape2.computeVertexNormals();sails.add(new T.Mesh(shape2,new T.MeshStandardMaterial({color:0xfaf7ee,side:T.DoubleSide,roughness:.9})));
 const wake=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:9},(_,i)=>new T.Vector3(0,.28,-9-i*3))),new T.LineBasicMaterial({color:0xf2f3ec,transparent:true,opacity:.48}));root.add(wake);
 return{update(t){root.position.y=seaLevel+.15+Math.sin(t*.8+phase)*.16;root.rotation.z=Math.sin(t*.51+phase)*.022;root.rotation.x=Math.sin(t*.4+phase)*.012;sails.rotation.y=Math.sin(t*.13+phase)*.055;}};
}
function motorboat(scene,{position,heading=0,phase=0,scale=1,color=0x284e60,seaLevel=1.8}){
 const root=new T.Group(),[x,z]=toLocal(...position);root.position.set(x,seaLevel,z);root.rotation.y=-heading;root.scale.setScalar(scale);scene.add(root);
 const hull=new T.Mesh(new T.SphereGeometry(1,20,10),new T.MeshStandardMaterial({color,roughness:.43,metalness:.16}));hull.scale.set(2.5,1.05,6.8);hull.position.y=1.25;root.add(hull);
 const deck=new T.Mesh(box,new T.MeshStandardMaterial({color:0xe9e5d9,roughness:.72}));deck.scale.set(3.8,.26,8);deck.position.y=2.1;root.add(deck);
 const cabin=new T.Mesh(box,new T.MeshStandardMaterial({color:0xf2eee3,roughness:.58}));cabin.scale.set(2.5,1.8,3.2);cabin.position.set(0,3.05,.5);root.add(cabin);
 const windows=new T.Mesh(box,new T.MeshStandardMaterial({color:0x315768,metalness:.22,roughness:.22}));windows.scale.set(2.58,.85,3.28);windows.position.set(0,3.2,.5);root.add(windows);
 const roof=new T.Mesh(box,new T.MeshStandardMaterial({color:phase%2?0xf3eee3:0xc1d0cb,roughness:.65}));roof.scale.set(2.8,.24,3.5);roof.position.set(0,4.08,.5);root.add(roof);
 const bow=new T.Mesh(box,new T.MeshStandardMaterial({color:0xe7dfcb,roughness:.73}));bow.scale.set(1.6,.18,2.1);bow.position.set(0,2.5,-4.2);root.add(bow);
 const wake=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:7},(_,i)=>new T.Vector3(0,.38,-6.5-i*2.6))),new T.LineBasicMaterial({color:0xf2f3ec,transparent:true,opacity:.4}));root.add(wake);
 return{update(t){root.position.y=seaLevel+.12+Math.sin(t*.95+phase)*.12;root.rotation.z=Math.sin(t*.58+phase)*.014;root.rotation.x=Math.cos(t*.47+phase)*.012;}};
}
export class HarborFleet{
 constructor(scene){this.ships=[cargoShip(scene,{position:[5.337,43.312],heading:.3,phase:.2}),cargoShip(scene,{position:[5.321,43.321],heading:1.1,scale:.78,phase:2.7}),sailboat(scene,{position:[5.346,43.300],heading:.9,phase:1}),sailboat(scene,{position:[5.326,43.299],heading:-.35,phase:2}),sailboat(scene,{position:[5.340,43.280],heading:1.7,phase:3}),sailboat(scene,{position:[5.363,43.295],heading:.4,phase:.7,scale:.58,seaLevel:1.8}),sailboat(scene,{position:[5.368,43.295],heading:2.3,phase:1.8,scale:.46,seaLevel:1.8}),motorboat(scene,{position:[5.365,43.295],heading:-.7,phase:.6,scale:.85}),motorboat(scene,{position:[5.370,43.295],heading:2.1,phase:2.1,scale:1.08,color:0x914a38}),motorboat(scene,{position:[5.3605,43.294],heading:.2,phase:2.7,scale:.72,color:0xd9d0b9})];}
 update(t){for(const ship of this.ships)ship.update(t);}
}
