import {sampleGrid} from './geo.js';

// The surface raster includes trees too: accept only samples near the surveyed
// building height, inside the tile and with no missing interpolation corners.
export function measuredRoofHeight(terrain,point,floor,ceiling){
 if(!terrain.surfaceHeights)return floor;
 const [x,z]=point,[w,n,e,s]=terrain.bounds;
 if(x<w||x>e||z<n||z>s)return floor;
 const size=terrain.size,u=Math.min(size-2,Math.floor((x-w)/(e-w)*(size-1))),v=Math.min(size-2,Math.floor((z-n)/(s-n)*(size-1))),a=terrain.surfaceHeights;
 if(![a[v*size+u],a[v*size+u+1],a[(v+1)*size+u],a[(v+1)*size+u+1]].every(Number.isFinite))return floor;
 const h=sampleGrid({...terrain,heights:a},x,z);
 return h>=floor-1&&h<=ceiling?Math.max(floor,h):floor;
}
export function subdivideRoof(a,b,c,emit,depth=0){
 const points=[a,b,c],lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%3][0],p[1]-points[(i+1)%3][1]));
 const index=lengths.indexOf(Math.max(...lengths));
 if(depth>=6||lengths[index]<=4){emit(a,b,c);return;}
 const p=points[index],q=points[(index+1)%3],r=points[(index+2)%3],mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];
 subdivideRoof(p,mid,r,emit,depth+1);subdivideRoof(mid,q,r,emit,depth+1);
}
