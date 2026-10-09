import {tileAt,toGeo} from './geo.js';
export function coastalPixel(world,x,z){
 const tile=world.tiles?.get(tileAt(...toGeo(x,z)).join('/')),image=tile?.terrainMesh?.material.map?.image;
 if(!image||!tile.ready)return null;
 const imageUrl=image.currentSrc||image.src;
 if(tile.coastalImageUrl!==imageUrl||!tile.coastalPixels){
  try{const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,512,512);tile.coastalPixels=context.getImageData(0,0,512,512).data;tile.coastalImageUrl=imageUrl;}catch{return null;}
 }
 const [w,n,e,s]=tile.terrain.bounds,u=Math.max(0,Math.min(511,Math.floor((x-w)/(e-w)*512))),v=Math.max(0,Math.min(511,Math.floor((z-n)/(s-n)*512))),offset=(v*512+u)*4;
 return tile.coastalPixels.slice(offset,offset+3);
}
export function dryPatch(world,x,z,terrain,pixel=coastalPixel){
 const samples=[[0,0],[-1.2,-1.8],[1.2,-1.8],[-1.2,1.8],[1.2,1.8],[0,-2],[0,2],[-1.5,0],[1.5,0]],heights=[];
 for(const [dx,dz] of samples){
  const height=world.ground(x+dx,z+dz);heights.push(height);
  if(!Number.isFinite(height)||world.surface(x+dx,z+dz)-height>1)return null;
  const color=pixel(world,x+dx,z+dz);
  if(world.tiles&&!color)return null;
  if(color){const [r,g,b]=color,water=b>r*1.07&&g>r*1.04;
   const vegetation=g>r*1.08&&g>b*1.08;
   if(water||vegetation||Math.max(r,g,b)<35)return null;
   if(terrain==='beach'&&(r<g*.95||g<b*1.04))return null;
  }
 }
 // A towel needs a reasonably level patch, even on the rocky shore.
 if(Math.max(...heights)-Math.min(...heights)>.45)return null;
 return Math.max(...heights);
}
export function sunPatches(world,spot,pixel=coastalPixel){
 const result=[],count=spot.terrain==='rock'?2:4;
 for(const radius of [0,7,14,24,38,55,80])for(let i=0;i<(radius?20:1);i++){
  const angle=i/20*Math.PI*2,x=spot.x+Math.cos(angle)*radius,z=spot.z+Math.sin(angle)*radius,y=dryPatch(world,x,z,spot.terrain,pixel);
  if(y===null||result.some(p=>Math.hypot(p.x-x,p.z-z)<4))continue;
  result.push({x,z,y});if(result.length===count)return result;
 }
 return result;
}
