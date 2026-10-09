import * as T from '../vendor/three/three.core.js';
const paint=new T.MeshStandardMaterial({color:0x252b2c,metalness:.68,roughness:.32});
const graphite=new T.MeshStandardMaterial({color:0x42494a,metalness:.58,roughness:.38});
const rubber=new T.MeshStandardMaterial({color:0x171a1b,roughness:.96});
const chrome=new T.MeshStandardMaterial({color:0xaeb9b7,metalness:.82,roughness:.24});
const glass=new T.MeshStandardMaterial({color:0x9cb8bd,metalness:.15,roughness:.16,transparent:true,opacity:.58,side:T.DoubleSide});
const lamp=new T.MeshStandardMaterial({color:0xfff1bf,emissive:0xd09535,emissiveIntensity:.55,roughness:.2});
const jacket=new T.MeshStandardMaterial({color:0x253941,roughness:.85});
const trousers=new T.MeshStandardMaterial({color:0x343437,roughness:.95});
const helmetMat=new T.MeshStandardMaterial({color:0xeee8d5,metalness:.16,roughness:.3});
const box=new T.BoxGeometry(1,1,1);
function shape(parent,geometry,material,scale,position){const m=new T.Mesh(geometry,material);m.scale.set(...scale);m.position.set(...position);parent.add(m);return m;}
function link(parent,a,b,radius,material){const v1=new T.Vector3(...a),v2=new T.Vector3(...b),delta=v2.clone().sub(v1),m=new T.Mesh(new T.CylinderGeometry(radius*.82,radius,delta.length(),9),material);m.position.copy(v1.add(v2).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());parent.add(m);return m;}
export function createTmax(){
 const root=new T.Group(),chassis=new T.Group();root.add(chassis);const wheels=[],steeringAssembly=new T.Group(),handlebar=new T.Group();steeringAssembly.position.set(0,.32,-.78);root.add(steeringAssembly);handlebar.position.set(0,1.38,-.78);chassis.add(handlebar);
 for(const z of [-.78,.63]){const wheel=new T.Group();wheel.position.set(0,.32,z);const tire=new T.Mesh(new T.TorusGeometry(.285,.075,12,28),rubber);tire.rotation.y=Math.PI/2;wheel.add(tire);const rim=new T.Mesh(new T.TorusGeometry(.19,.018,8,20),chrome);rim.rotation.y=Math.PI/2;wheel.add(rim);const hub=new T.Mesh(new T.CylinderGeometry(.065,.065,.22,12),graphite);hub.rotation.z=Math.PI/2;wheel.add(hub);for(let i=0;i<8;i++){const a=i*Math.PI/4;link(wheel,[0,Math.cos(a)*.07,Math.sin(a)*.07],[0,Math.cos(a)*.18,Math.sin(a)*.18],.009,chrome);}if(z<0){wheel.position.set(0,0,0);steeringAssembly.add(wheel);}else root.add(wheel);wheels.push(wheel);}
 shape(chassis,box,new T.MeshStandardMaterial({color:0x505858,metalness:.75,roughness:.4}),[.18,.2,1.22],[0,.48,-.04]);
 shape(chassis,box,paint,[.48,.48,.63],[0,.79,.27]);shape(chassis,box,graphite,[.48,.12,.72],[0,.52,-.05]);
 const fairing=shape(chassis,box,paint,[.48,.77,.42],[0,.91,-.61]);fairing.rotation.x=-.1;
 shape(chassis,box,glass,[.39,.43,.045],[0,1.48,-.76]).rotation.x=-.16;
 shape(chassis,new T.SphereGeometry(1,18,12),lamp,[.19,.11,.045],[0,.91,-.835]);
 shape(chassis,box,new T.MeshStandardMaterial({color:0xb92f2b,emissive:0x3c0704}),[.2,.065,.035],[0,1.04,.61]);
 shape(chassis,box,paint,[.49,.13,.74],[0,1.03,.02]);shape(chassis,box,graphite,[.37,.12,.47],[0,1.15,.12]);shape(chassis,box,rubber,[.39,.12,.52],[0,1.22,.37]);
 link(chassis,[0,.77,-.72],[0,1.37,-.78],.045,chrome);link(handlebar,[-.35,0,0],[.35,0,0],.035,graphite);
 for(const s of [-1,1]){link(handlebar,[s*.26,-.01,0],[s*.37,.34,.01],.016,chrome);shape(handlebar,new T.SphereGeometry(1,12,8),graphite,[.11,.075,.055],[s*.37,.38,.01]);shape(handlebar,new T.SphereGeometry(.08,12,8),rubber,[.075,.055,.045],[s*.35,0,0]);link(steeringAssembly,[s*.10,0,0],[s*.10,.55,-.03],.028,chrome);}
 const rider=new T.Group();root.add(rider);shape(rider,new T.SphereGeometry(1,20,16),jacket,[.245,.34,.22],[0,1.49,.0]);shape(rider,new T.SphereGeometry(1,20,16),helmetMat,[.18,.2,.18],[0,1.94,-.02]);shape(rider,box,graphite,[.22,.065,.23],[0,1.94,-.16]);
 for(const s of [-1,1]){link(rider,[s*.19,1.69,-.06],[s*.27,1.49,-.3],.065,jacket);link(rider,[s*.27,1.49,-.3],[s*.3,1.38,-.73],.052,jacket);shape(rider,new T.SphereGeometry(.065,10,8),rubber,[1,1,1],[s*.3,1.38,-.74]);link(rider,[s*.13,1.27,.05],[s*.2,.88,-.02],.083,trousers);link(rider,[s*.2,.88,-.02],[s*.22,.55,-.38],.07,trousers);shape(rider,box,rubber,[.13,.08,.27],[s*.22,.52,-.43]);}
 return{root,chassis,rider,wheels,steeringAssembly,handlebar,animate(state,dt=0){root.position.set(state.x,state.altitude,state.z);root.rotation.set(state.pitch||0,-state.heading,-state.lean,'YXZ');chassis.position.y=-(state.landingCompression||0);rider.position.y=-(state.landingCompression||0)*.8;steeringAssembly.rotation.y=handlebar.rotation.y= -((state.steering||0)-(state.slipAngle||0)*.55);const spin=state.speed*dt/.36;for(const wheel of wheels)wheel.rotation.x-=spin;rider.rotation.z=-state.lean*.08;}};
}
