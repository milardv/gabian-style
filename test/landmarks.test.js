import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.module.js';
import {LandmarkOverlay} from '../public/flight/landmarks.js';

function setup(t){
 const originalDocument=globalThis.document,originalStyle=globalThis.getComputedStyle;
 t.after(()=>{globalThis.document=originalDocument;globalThis.getComputedStyle=originalStyle;});
 const children=[],counts={created:0,measured:0,queried:0},obstacles=[];
 globalThis.document={querySelectorAll:()=>obstacles,createElement(){counts.created++;return{style:{},dataset:{},textContent:'',
  get offsetWidth(){counts.measured++;return 160;},get offsetHeight(){counts.measured++;return 28;},
  remove(){const index=children.indexOf(this);if(index>=0)children.splice(index,1);}};}};
 globalThis.getComputedStyle=()=>({visibility:'visible',display:'block'});
 const place={name:'Notre-Dame',kind:'Basilique',x:0,z:-500,height:100,distance:500},items=[place];
 const world={surface:()=>100,nearbyLandmarks(){counts.queried++;return items;}};
 const camera=new T.PerspectiveCamera(65,1440/900,.1,5000);camera.position.set(0,200,0);camera.lookAt(0,100,-500);
 const overlay=new LandmarkOverlay({append:node=>children.push(node)},{has:()=>false});
 const update=(dt=1/60)=>overlay.update(world,camera,{x:0,z:0},1440,900,dt);
 return{children,counts,obstacles,place,items,world,camera,overlay,update};
}
test('Les étiquettes suivent chaque image de caméra sans attendre le prochain relevé',t=>{
 const {children,counts,camera,update}=setup(t);update();const node=children[0],first=node.style.transform,measurements=counts.measured;
 camera.lookAt(20,100,-500);update();const second=node.style.transform;
 camera.lookAt(40,100,-500);update();assert.notEqual(second,first);assert.notEqual(node.style.transform,second);
 assert.equal(children[0],node);assert.equal(counts.queried,1);assert.equal(counts.measured,measurements);
 assert.match(node.style.transform,/translate3d\(-?\d+\.\d{2}px,-?\d+\.\d{2}px,0\)/);
});
test('Masquer et retrouver un lieu conserve son élément au lieu de le recréer',t=>{
 const {children,counts,camera,update}=setup(t);update();const node=children[0];
 camera.lookAt(0,200,500);update();assert.equal(node.style.opacity,'0.000');assert.equal(node.style.visibility,'hidden');
 camera.lookAt(0,100,-500);update();assert.equal(children[0],node);assert.equal(counts.created,1);assert.ok(Number(node.style.opacity)>0);
});
test('Les changements de priorité par distance ne font pas permuter deux lieux superposés',t=>{
 const {children,items,place,update}=setup(t);items.push({...place,name:'Second lieu',distance:510});update();
 assert.ok(Number(children[0].style.opacity)>0);assert.equal(children[1].style.opacity,'0.000');
 items.reverse();items[0].distance=490;for(let i=0;i<20;i++)update();
 assert.equal(children[0].textContent,'Notre-Dame');assert.ok(Number(children[0].style.opacity)>.5);assert.equal(children[1].style.opacity,'0.000');
});
test('Les panneaux restent dégagés et les éléments quittant la zone sont libérés',t=>{
 const {children,obstacles,items,update}=setup(t);obstacles.push({hidden:false,getBoundingClientRect:()=>({left:0,right:1440,top:0,bottom:900})});
 update();assert.equal(children[0].style.opacity,'0.000');items.length=0;for(let i=0;i<20;i++)update();assert.equal(children.length,0);
});
