import {angleDelta,WIND_DIRECTION} from './sailboat-physics.js';
// A little clearance around the entire hull, plus room to leave the obstacle.
function clearHull(x,z,heading,environment){
 for(const lateral of [-1.5,0,1.5])for(const forward of [-3.5,-2,0,2,4,6]){
  const px=x+Math.sin(heading)*forward+Math.cos(heading)*lateral,pz=z-Math.cos(heading)*forward+Math.sin(heading)*lateral;
  if(environment.contains?.(px,pz)===false||environment.isWater(px,pz)!==true)return false;
 }
 return true;
}
export function nearbySailboatRecovery(state,environment){
 // Prefer backing off the impact, then try the closest surrounding patches of water.
 const backwards=state.heading+Math.PI;
 for(const distance of [4,6,8,12,18,24])for(let i=0;i<24;i++){
  const index=i===0?0:Math.ceil(i/2)*(i%2?1:-1),escape=backwards+index*Math.PI/12;
  const x=state.x+Math.sin(escape)*distance,z=state.z-Math.cos(escape)*distance;
  for(const offset of [0,-.55,.55,-.95,.95]){
   const heading=escape+offset;
   // A stopped sailing boat cannot leave if it is pointed straight into the wind.
   if((environment.wind??2)>.05&&Math.abs(angleDelta(heading,WIND_DIRECTION+Math.PI))<50*Math.PI/180)continue;
   if(clearHull(x,z,heading,environment))return {x,z,heading,distance};
  }
 }
 return null;
}
