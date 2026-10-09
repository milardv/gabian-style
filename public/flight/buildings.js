import { ShapeUtils, Vector2 } from '../vendor/three/three.core.js';
import { sampleGrid } from './geo.js';
import {measuredRoofHeight,subdivideRoof} from './measured-roofs.js';
export function buildGeometry(buildings, terrain, structures = []) {
  const sides = [], uvs = [], roofs = [], roofUvs = [], colors = [], domes = [], domeColors = [], towers = [], towerColors = [], statues = [], statueColors = [];
  const push = (array, a, b, c) => array.push(...a, ...b, ...c);
  for (const building of buildings) {
    const ground = sampleGrid(terrain, ...building.center);
    const base = Math.max(ground - .8, building.base ?? ground);
    const top = Math.max(base + building.height, building.roof ?? 0);
    const measured=!!terrain.surfaceHeights&&building.nature!=='Eglise',roofFloor=measured&&Number.isFinite(building.roof)?Math.max(base+2,building.roof):top;
    const roofHeight=point=>{
      if(!measured)return top;
      // Keep the surveyed eaves on every footprint edge, including courtyards.
      // Sampling a mixed ground/roof pixel there would tear roofs away from walls.
      for(const ring of building.rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;if(!length)continue;const t=((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length;if(t>=0&&t<=1&&Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz)<.01)return roofFloor;}
      return measuredRoofHeight(terrain,point,roofFloor,top+Math.min(10,building.height*.5));
    };
    building.collision_roof = top;
    const rings = building.rings.map(ring => {
      const list = ring.slice();
      if (list.length > 1 && Math.hypot(list[0][0] - list.at(-1)[0], list[0][1] - list.at(-1)[1]) < .01) list.pop();
      return list;
    });
    if (rings[0].length < 3) continue;
    const contour = rings[0].map(p => new Vector2(...p)), holes = rings.slice(1).map(ring => ring.map(p => new Vector2(...p)));
    const points = rings.flat();
    const triangles = ShapeUtils.triangulateShape(contour, holes);
    const style = [...building.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
    const tint=.88+style*.035;
    const [west, north, east, south] = terrain.bounds;
    const roofTriangle=(a,b,c)=>{for(const point of [a,c,b]){const h=roofHeight(point);building.collision_roof=Math.max(building.collision_roof,h);roofs.push(point[0],h,point[1]);roofUvs.push((point[0]-west)/(east-west),1-(point[1]-north)/(south-north));colors.push(1,1,1);}};
    for(const tri of triangles){const [a,b,c]=tri.map(i=>points[i]);if(measured)subdivideRoof(a,b,c,roofTriangle);else roofTriangle(a,b,c);}
    if (building.nature === 'Eglise') {
      const xs = rings[0].map(p => p[0]), zs = rings[0].map(p => p[1]);
      const width = Math.max(...xs) - Math.min(...xs), depth = Math.max(...zs) - Math.min(...zs);
      const area = Math.abs(rings[0].reduce((sum, p, i, r) => sum + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0)) / 2;
      if (area > 500 && Math.min(width, depth) > 18 && Math.max(width, depth) < 90) {
        const radius = Math.min(width, depth) * .17, rise = Math.min(12, radius * .8), segments = 20, steps = 7;
        for (let j = 0; j < steps; j++) for (let i = 0; i < segments; i++) {
          const vertex = (level, sector) => { const a = sector / segments * Math.PI * 2, t = level / steps * Math.PI / 2, r = radius * Math.cos(t); return [building.center[0] + Math.cos(a) * r, top + rise * Math.sin(t), building.center[1] + Math.sin(a) * r]; };
          const a = vertex(j, i), b = vertex(j, i + 1), c = vertex(j + 1, i), d = vertex(j + 1, i + 1);
          push(domes, a, c, b); push(domes, b, c, d);
          for (let k = 0; k < 6; k++) domeColors.push(.76 + tint * .12, .65 + tint * .1, .49 + tint * .11);
        }
      }
    }
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const baseA=Math.max(sampleGrid(terrain,...a)-.8,building.base??ground),baseB=Math.max(sampleGrid(terrain,...b)-.8,building.base??ground),width=Math.hypot(a[0]-b[0],a[1]-b[1])/3.4,topA=roofHeight(a),topB=roofHeight(b),heightA=(topA-baseA)/3.2,heightB=(topB-baseB)/3.2;
      push(sides,[a[0],baseA,a[1]],[b[0],baseB,b[1]],[b[0],topB,b[1]]);
      push(sides,[a[0],baseA,a[1]],[b[0],topB,b[1]],[a[0],topA,a[1]]);
      const u=style/4,w=width/4;uvs.push(u,0,u+w,0,u+w,heightB,u,0,u+w,heightB,u,heightA);
    }
  }
  for (const structure of structures) {
    const [x,z] = structure.center, ground = sampleGrid(terrain,x,z), top = Math.max(ground+3,structure.top), radius = structure.nature === 'Clocher' ? 3.1 : 1.5, levels = structure.nature === 'Clocher' ? 2 : 1, tint = structure.nature === 'Clocher' ? [.69,.61,.49] : [.57,.55,.47], cap=Math.min(radius*1.55,(top-ground)*.35), shaftTop=top-cap;
    for(let level=0;level<levels;level++){
      const y0=ground+(shaftTop-ground)*level/levels,y1=ground+(shaftTop-ground)*(level+1)/levels,r0=radius*(1-.12*level),r1=radius*(1-.12*(level+1));
      for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;const p=[x+Math.cos(a)*r0,y0,z+Math.sin(a)*r0],q=[x+Math.cos(b)*r0,y0,z+Math.sin(b)*r0],u=[x+Math.cos(b)*r1,y1,z+Math.sin(b)*r1],v=[x+Math.cos(a)*r1,y1,z+Math.sin(a)*r1];push(towers,p,q,u);push(towers,p,u,v);for(let k=0;k<6;k++)towerColors.push(...tint);}
    }
    for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;towers.push(x+Math.cos(a)*radius,shaftTop,z+Math.sin(a)*radius,x+Math.cos(b)*radius,shaftTop,z+Math.sin(b)*radius,x,top,z);for(let k=0;k<3;k++)towerColors.push(...tint.map(v=>v*.88));}
    if(structure.nature==='Clocher'&&top>190){const gold=[.95,.58,.12],ellipsoid=(cx,cy,cz,rx,ry,rz)=>{const steps=8,sectors=12,vertex=(j,i)=>{const a=i/sectors*Math.PI*2,t=j/steps*Math.PI;return[cx+rx*Math.sin(t)*Math.cos(a),cy+ry*Math.cos(t),cz+rz*Math.sin(t)*Math.sin(a)];};for(let j=0;j<steps;j++)for(let i=0;i<sectors;i++){const a=vertex(j,i),b=vertex(j,i+1),c=vertex(j+1,i),d=vertex(j+1,i+1);push(statues,a,b,c);push(statues,b,d,c);for(let k=0;k<6;k++)statueColors.push(...gold);}};ellipsoid(x,top-4,z,1.25,2.8,.9);ellipsoid(x,top-.85,z,1.05,1.05,.95);ellipsoid(x,top-3.7,z,2.45,.65,.7);}
  }
  return { sides: new Float32Array(sides), uvs: new Float32Array(uvs), roofs: new Float32Array(roofs), roofUvs:new Float32Array(roofUvs), colors: new Float32Array(colors), domes: new Float32Array(domes), domeColors: new Float32Array(domeColors), towers:new Float32Array(towers),towerColors:new Float32Array(towerColors),statues:new Float32Array(statues),statueColors:new Float32Array(statueColors),collisionRoofs: buildings.map(b => b.collision_roof || 0) };
}
