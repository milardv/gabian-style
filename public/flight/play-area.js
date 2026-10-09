import {inPolygons,toLocal} from './geo.js';

// The coastal flight/sailing corridor is geographic. Terrain resolution and
// tile arrivals must never change whether the same position is playable.
export const MARSEILLE_WATER_ZONE=[[5.235,43.24],[5.25,43.215],[5.29,43.19],[5.36,43.185],[5.43,43.195],[5.49,43.22],[5.50,43.255],[5.47,43.29],[5.43,43.32],[5.38,43.34],[5.33,43.34],[5.29,43.32],[5.26,43.29]].map(p=>toLocal(...p));
export function containsPlayArea(x,z,boundary,waterZone=MARSEILLE_WATER_ZONE){
 if(!boundary||!Number.isFinite(x)||!Number.isFinite(z))return false;
 const [w,n,e,s]=boundary.bounds;
 if(x<w||x>e||z<n||z>s)return false;
 return inPolygons(x,z,boundary.polygons)||inPolygons(x,z,[[waterZone]]);
}
