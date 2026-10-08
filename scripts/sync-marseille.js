import {marseilleBoundary,marseilleOverview,marseilleTerrain,marseilleBuildings,marseilleImagery} from '../lib/marseille-data.js';
import {tileAt} from '../public/flight/geo.js';
await marseilleBoundary();await marseilleOverview();const [x,y]=tileAt(5.3738,43.295);
const [gx,gy]=tileAt(5.371189,43.283955);const tiles=[[x,y],[x-1,y],[x,y-1],[x+1,y],[x,y+1],[gx,gy]];for(const [a,b]of [...new Map(tiles.map(v=>[v.join('/'),v])).values()]){const terrain=await marseilleTerrain(a,b);const buildings=await marseilleBuildings(a,b);await marseilleImagery(a,b);console.log(`${a}/${b} : ${terrain.heights.length} points de relief, ${buildings.buildings.length} bâtiments, ${buildings.structures.length} points hauts.`);}
console.log('Marseille : cache de départ prêt.');
