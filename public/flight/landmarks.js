import * as T from '../vendor/three/three.module.js';
import {landmarkKey} from './exploration.js';

const overlaps=(a,b)=>a.left<b.right+8&&a.right>b.left-8&&a.top<b.bottom+8&&a.bottom>b.top-8;
const obstacleSelector='.flight-header>div,.flight-location,.mission-card,.map-panel,.telemetry,.cockpit,.help,.exploration-panel,.exploration-toggle,.touch-pad,.touch-actions,.match-indicator';

export class LandmarkOverlay {
 constructor(root,exploration){
  this.root=root;this.exploration=exploration;this.nodes=new Map();this.point=new T.Vector3();
  this.clock=0;this.refreshAt=-Infinity;this.obstacles=[];this.width=0;this.height=0;
  this.reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 }
 refresh(world,position,width,height){
  const retained=new Set();
  // Discovery, terrain sampling and DOM measurements are independent of camera motion.
  for(const item of world.nearbyLandmarks(position.x,position.z,1400).slice(0,30)){
   const key=landmarkKey(item);retained.add(key);let label=this.nodes.get(key);
   if(!label){
    const node=document.createElement('div');node.className='landmark-label';node.style.opacity='0';
    this.root.append(node);label={node,item,opacity:0,selected:false,y:0};this.nodes.set(key,label);
   }
   label.item=item;label.targetY=Math.max(item.height??0,world.surface(item.x,item.z))+12;
   if(!label.initialized){label.y=label.targetY;label.initialized=true;}
   const visited=this.exploration.has(item),text=`${visited?'✓ ':''}${item.name}`;
   if(label.node.textContent!==text)label.node.textContent=text;
   label.node.dataset.visited=String(visited);
   label.node.style.maxWidth=`${Math.min(190,width-32)}px`;
   label.node.title=`${item.kind||'Lieu remarquable'}${visited?' · Visité':''}`;
  }
  for(const [key,label]of this.nodes)if(!retained.has(key)){label.node.remove();this.nodes.delete(key);}
  // All writes precede layout reads. No measurements in the frame-by-frame projection.
  for(const label of this.nodes.values()){label.width=label.node.offsetWidth||190;label.height=label.node.offsetHeight||30;}
  this.obstacles=[...document.querySelectorAll(obstacleSelector)]
   .filter(el=>!el.hidden&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none')
   .map(el=>el.getBoundingClientRect());
  this.width=width;this.height=height;
 }
 update(world,camera,position,width,height,dt=1/60){
  const step=Math.max(0,Math.min(dt,.1));this.clock+=step;
  if(this.clock-this.refreshAt>=.25||width!==this.width||height!==this.height){
   this.refreshAt=this.clock;this.refresh(world,position,width,height);
  }
  camera.updateMatrixWorld();
  const occupied=[...this.obstacles];let shown=0;
  // Keep existing labels ahead of newcomers to avoid swapping on tiny distance changes.
  const labels=[...this.nodes.values()].sort((a,b)=>Number(b.selected)-Number(a.selected)||a.item.distance-b.item.distance);
  for(const label of labels){
   const {item,node}=label;label.y+=(label.targetY-label.y)*(1-Math.exp(-8*step));
   this.point.set(item.x,label.y,item.z).applyMatrix4(camera.matrixWorldInverse);
   const inFront=this.point.z<-1;this.point.applyMatrix4(camera.projectionMatrix);
   const inView=inFront&&this.point.z>=-1&&this.point.z<=1&&Math.abs(this.point.x)<=1&&Math.abs(this.point.y)<=1;
   let selected=false;
   if(inView){
    const x=(this.point.x+1)*width/2,y=(1-this.point.y)*height/2;
    const left=x-label.width/2,top=y-label.height-20;
    const rect={left,right:left+label.width,top,bottom:y};
    selected=shown<5&&left>=12&&rect.right<=width-12&&top>=85&&rect.bottom<=height-24&&!occupied.some(other=>overlaps(rect,other));
    // Fractional positions exactly follow this rendered camera, with no trailing CSS tween.
    node.style.transform=`translate3d(${left.toFixed(2)}px,${top.toFixed(2)}px,0)`;
    if(selected){occupied.push(rect);shown++;}
   }
   label.selected=selected;
   const distance=Math.hypot(item.x-position.x,item.z-position.z);
   const target=selected?Math.max(.68,.98-distance/4500):0;
   label.opacity=this.reducedMotion?target:label.opacity+(target-label.opacity)*(1-Math.exp(-18*step));
   // Behind-camera labels must disappear immediately rather than flash across the screen.
   if(!inView)label.opacity=0;
   node.style.opacity=label.opacity.toFixed(3);node.style.visibility=label.opacity<.01?'hidden':'visible';
  }
 }
}
