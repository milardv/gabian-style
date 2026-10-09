import {readFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {COAST_DIR,COAST_KEYS} from '../public/flight/coast-config.js';
import {splitTerrainGrid} from './coast-grid.js';
import {terrainGLB} from './terrain-tiles.js';

const dir=new URL(`../public${COAST_DIR}`,import.meta.url),grids=new Map(),pending=new Map(),models=new Map();let modelBytes=0;
export async function coastGrid(x,y){
 const key=`${x}/${y}`;if(!COAST_KEYS.has(key))return null;
 if(grids.has(key)){const grid=grids.get(key);grids.delete(key);grids.set(key,grid);return grid;}
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{const grid=JSON.parse(gunzipSync(await readFile(new URL(`${x}-${y}.json.gz`,dir))));grids.set(key,grid);while(grids.size>4)grids.delete(grids.keys().next().value);return grid;})();
 pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
export async function coastModel(name){
 const match=/^(\d{5})-(\d{5})(?:-q([0-3]))?-([128])\.glb$/.exec(name);
 if(!match)return null;
 const [,x,y,q,stride]=match;if(!COAST_KEYS.has(`${x}/${y}`)||q===undefined&&stride!=='8'||q!==undefined&&stride==='8')return null;
 if(models.has(name)){const bytes=models.get(name);models.delete(name);models.set(name,bytes);return bytes;}
 let grid=await coastGrid(x,y);if(q!==undefined)grid=splitTerrainGrid(grid,Number(q));
 const stem=`${x}-${y}${q===undefined?'':`-q${q}`}`,raw=terrainGLB(grid,Number(stride),stem+'.jpg','© IGN ; © Métropole Aix-Marseille-Provence, orthophoto 2022 — Licence Ouverte 2.0');
 const bytes=gzipSync(raw,{level:4});
 if(!models.has(name)){models.set(name,bytes);modelBytes+=bytes.length;}
 while(modelBytes>24*1024*1024){const first=models.keys().next().value;modelBytes-=models.get(first).length;models.delete(first);}
 return bytes;
}
