import * as T from '../vendor/three/three.core.js';
import {waveHeight} from './sailboat-physics.js';
const box=new T.BoxGeometry(1,1,1);
function sailGeometry(height,foot){
 const vertices=[],indices=[],uv=[],rows=12;
 for(let row=0;row<=rows;row++)for(let col=0;col<=rows;col++){const v=row/rows,u=col/rows;vertices.push(0,v*height,u*foot*(1-v));uv.push(u,v);}
 for(let row=0;row<rows;row++)for(let col=0;col<rows;col++){const a=row*(rows+1)+col,b=a+rows+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return {geometry:g,uv,height,foot};
}
export function createSailboatModel(scene,{reducedMotion=false}={}){
 const root=new T.Group();scene.add(root);
 const white=new T.MeshStandardMaterial({color:0xfff8e5,roughness:.62}),blue=new T.MeshStandardMaterial({color:0x164bc1,roughness:.4}),wood=new T.MeshStandardMaterial({color:0xb78a57,roughness:.8}),metal=new T.MeshStandardMaterial({color:0xc9d2d2,metalness:.65,roughness:.35});
 const part=(geometry,material,x,y,z,sx=1,sy=1,sz=1,parent=root)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
 // Loft a pointed bow and rounded stern, with a displacement hull below the waterline.
 const positions=[],indices=[],sections=24,ring=16;
 for(let j=0;j<=sections;j++){const t=j/sections,z=-3.15+t*6.1,width=Math.pow(Math.sin(t*Math.PI*.94),.55)*1.04;
  for(let k=0;k<=ring;k++){const a=k/ring*Math.PI;positions.push(Math.cos(a)*width,.5-Math.sin(a)*.86,z);}}
 for(let j=0;j<sections;j++)for(let k=0;k<ring;k++){const a=j*(ring+1)+k,b=a+ring+1;indices.push(a,a+1,b,b,a+1,b+1);}
 const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(positions,3));hull.setIndex(indices);hull.computeVertexNormals();root.add(new T.Mesh(hull,new T.MeshStandardMaterial({color:0xfff8e5,side:T.DoubleSide,roughness:.5})));
 const deckShape=new T.Shape();deckShape.moveTo(0,-3.15);deckShape.bezierCurveTo(1.15,-1.9,1.35,2.15,.5,2.95);deckShape.lineTo(-.5,2.95);deckShape.bezierCurveTo(-1.35,2.15,-1.15,-1.9,0,-3.15);
 const deck=part(new T.ShapeGeometry(deckShape,24),new T.MeshStandardMaterial({color:0xfff8e5,side:T.DoubleSide,roughness:.65}),0,.51,0);deck.rotation.x=Math.PI/2;
 part(box,blue,0,.53,1.55,1.25,.06,1.6);part(box,white,0,.73,-.75,1.35,.42,1.65);
 part(box,blue,0,.87,-.76,1.37,.1,.85);part(box,blue,0,-.7,-.2,.12,.9,1.15);
 part(new T.CylinderGeometry(.045,.065,6.5,8),metal,0,3.72,-.6);
 const boom=new T.Group();boom.position.set(0,1.1,-.6);root.add(boom);part(new T.CylinderGeometry(.035,.035,2.8,8),metal,0,0,1.4,1,1,1,boom).rotation.x=Math.PI/2;
 const cloth=new T.MeshStandardMaterial({color:0xfff8e5,side:T.DoubleSide,roughness:.95});
 const main=sailGeometry(5.75,2.75),mainMesh=new T.Mesh(main.geometry,cloth);boom.add(mainMesh);
 const jibPivot=new T.Group();jibPivot.position.set(0,.72,-2.9);root.add(jibPivot);const jib=sailGeometry(5.15,2.25);jib.forestay=2.3;jib.isJib=true;jibPivot.add(new T.Mesh(jib.geometry,cloth));
 // Standing rigging is anchored to the deck and mast, never animated independently.
 for(const x of [-.9,.9])root.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x,.6,.2),new T.Vector3(0,6.8,-.6),new T.Vector3(0,.65,-3)]),new T.LineBasicMaterial({color:0x737e83})));
 const rudder=new T.Group();rudder.position.set(0,.4,2.65);root.add(rudder);part(box,wood,0,-.55,0,.05,1.1,.5,rudder);part(box,wood,0,.4,-.5,.055,.055,1.05,rudder);
 const crew=new T.Group();crew.position.set(-.66,.73,1.45);root.add(crew);part(new T.SphereGeometry(.17,12,8),new T.MeshStandardMaterial({color:0xd6a179}),0,.63,0,1,1.1,1,crew);part(box,blue,0,.25,0,.3,.42,.2,crew);part(box,wood,.17,0,-.22,.45,.14,.18,crew);part(new T.CylinderGeometry(.2,.2,.05,12),white,0,.8,0,1,1,1,crew);
 const waterGeometry=new T.PlaneGeometry(100,100,32,32);waterGeometry.rotateX(-Math.PI/2);
 const waterColors=[];for(let i=0;i<waterGeometry.attributes.position.count;i++){const p=waterGeometry.attributes.position,r=Math.hypot(p.getX(i),p.getZ(i));waterColors.push(1,1,1,Math.max(0,Math.min(1,(48-r)/20)));}waterGeometry.setAttribute('color',new T.Float32BufferAttribute(waterColors,4));
 const water=new T.Mesh(waterGeometry,new T.MeshPhongMaterial({color:0x28667b,shininess:24,specular:0x698f9b,vertexColors:true,transparent:true,opacity:.06,depthWrite:false}));scene.add(water);water.renderOrder=1;
 const wakeGeometry=new T.BufferGeometry(),wakePositions=new Float32Array(120*12);wakeGeometry.setAttribute('position',new T.BufferAttribute(wakePositions,3));
 const wake=new T.LineSegments(wakeGeometry,new T.LineBasicMaterial({color:0xe4f1ec,transparent:true,opacity:.38,depthWrite:false}));scene.add(wake);let trail=[],lastTime=null,maskTime=-Infinity,lastRenderTime=null;
 function clothShape(sail,s){const p=sail.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const [u,v]=[sail.uv[i*2],sail.uv[i*2+1]],belly=Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
   const pressure=Math.min(1,s.apparentWind/6)*s.power*.22,luff=s.luffing&&!reducedMotion?Math.min(.06,s.apparentWind*.01)*Math.sin(s.time*9+v*5+u*4):0;
   const foot=u*sail.foot*(1-v),sheet=sail.isJib?s.boom*.45:0;
   p.setXYZ(i,Math.sin(sheet)*foot+(Math.tanh(s.boom*5)*pressure+luff)*belly,v*sail.height,(sail.forestay||0)*v+Math.cos(sheet)*foot);}p.needsUpdate=true;sail.geometry.computeVertexNormals();}
 function animate(s,dt,wind,visible=true,isWater=null){
  water.visible=wake.visible=visible;root.position.set(s.x,s.altitude,s.z);root.rotation.set(s.pitch,-s.heading,-s.heel,'YXZ');boom.rotation.y=s.boom;rudder.rotation.y=-s.rudder;
  const crewTarget=-Math.tanh(s.windAngle*3)*(.55+Math.min(.2,Math.abs(s.heel)));crew.position.x+=(crewTarget-crew.position.x)*(1-Math.exp(-3*dt));crew.rotation.z=s.heel*.6;
  if(lastRenderTime===s.time)return;lastRenderTime=s.time;
  clothShape(main,s);clothShape(jib,s);
  water.visible=wake.visible=visible;water.position.set(s.x,0,s.z);
  if(isWater&&(s.time-maskTime>1||s.time<maskTime)){maskTime=s.time;const c=waterGeometry.attributes.color,p=waterGeometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),fade=Math.max(0,Math.min(1,(48-Math.hypot(x,z))/20));c.setW(i,isWater(s.x+x,s.z+z)===true?fade:0);}c.needsUpdate=true;}
  const p=waterGeometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),fade=Math.max(0,1-Math.pow(Math.max(Math.abs(x),Math.abs(z))/50,4));p.setY(i,.035+(waveHeight(s.x+x,s.z+z,s.time,wind)-.035)*fade);}
  p.needsUpdate=true;waterGeometry.computeVertexNormals();
  if(lastTime===null||s.time<lastTime){trail=[];lastTime=s.time;}
  if(dt>0&&s.time-lastTime>.12){lastTime=s.time;if(s.speed>.3)trail.unshift({x:s.x-Math.sin(s.heading)*3,z:s.z+Math.cos(s.heading)*3,heading:s.heading,time:s.time,speed:s.speed});}
  trail=trail.filter(v=>s.time-v.time<7).slice(0,120);let n=0;
  for(const point of trail){const age=s.time-point.time,width=.3+age*.18,alpha=Math.max(0,1-age/7),len=Math.min(.8,point.speed*.15)*alpha;
   for(const side of [-1,1]){const x=point.x+Math.cos(point.heading)*width*side,z=point.z+Math.sin(point.heading)*width*side,y=waveHeight(x,z,s.time,wind)+.025;wakePositions.set([x,y,z,x-Math.sin(point.heading)*len,y,z+Math.cos(point.heading)*len],n);n+=6;}}
  wakeGeometry.setDrawRange(0,n/3);wakeGeometry.attributes.position.needsUpdate=true;wake.frustumCulled=false;
 }
 return {root,animate,reset(){trail=[];lastTime=null;maskTime=-Infinity;lastRenderTime=null;},setVisible(value){root.visible=water.visible=wake.visible=value;}};
}
