import {clearHull} from './sailboat-recovery.js';
import {angleDelta,WIND_DIRECTION} from './sailboat-physics.js';

// Search outward from the player, loading unknown coastal patches on demand.
// Fine rings near the shore leave room for the hull rather than landing on sand.
export async function nearestSailboatLaunch(position,environment){
 const heading=Number.isFinite(position.heading)?position.heading:Math.PI/2;
 const headings=[heading,heading+Math.PI/2,heading-Math.PI/2,heading+Math.PI].filter(h=>!(environment.wind>.05)||Math.abs(angleDelta(h,WIND_DIRECTION+Math.PI))>=50*Math.PI/180);
 async function ring(radius,spacing=20){
  const count=radius?Math.ceil(2*Math.PI*radius/spacing):1;
  for(let i=0;i<count;i++){
   const angle=heading+i/count*Math.PI*2,x=position.x+Math.sin(angle)*radius,z=position.z-Math.cos(angle)*radius;
   if(environment.contains?.(x,z)===false)continue;
   let water=environment.isWater(x,z);
   if(water===null){await environment.prepare(x,z);water=environment.isWater(x,z);}
   if(water!==true)continue;
   for(const h of headings)if(clearHull(x,z,h,environment))return {x,z,heading:h,distance:radius};
  }
  return null;
 }
 let previous=0;
 for(let radius=0;radius<=environment.maxDistance;radius+=radius<1000?20:80){
  const spot=await ring(radius,radius<1000?20:80);
  if(spot){
   if(radius-previous>20)for(let fine=previous+20;fine<=radius;fine+=20){const closer=await ring(fine);if(closer)return closer;}
   return spot;
  }
  previous=radius;
  if(radius%320===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return null;
}
