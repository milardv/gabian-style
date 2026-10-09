import {readFile,stat} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {COAST_KEYS,COAST_DIR} from '../public/flight/coast-config.js';
import {localBounds,tileBounds} from '../public/flight/geo.js';
const dir=new URL(`../public${COAST_DIR}`,import.meta.url),root=JSON.parse(await readFile(new URL('tileset.json',dir),'utf8'));
if(root.root.children.length!==COAST_KEYS.size)throw Error('Couverture du tileset incomplète');
const contents=new Set(root.root.children.map(t=>t.content.uri));
let minMeasured=Infinity,maxHeight=0;
for(const key of COAST_KEYS){
 const stem=key.replace('/','-'),grid=JSON.parse(gunzipSync(await readFile(new URL(stem+'.json.gz',dir))));
 if(!contents.has(stem+'.tiles.json')||grid.size!==513||grid.heights.length!==513**2||grid.surfaceHeights.length!==513**2||!grid.lidar_samples)throw Error(`Grille incomplète : ${key}`);
 const bounds=localBounds(tileBounds(...key.split('/').map(Number)));
 if(grid.bounds.some((v,i)=>Math.abs(v-bounds[i])>1e-6)||grid.heights.some(h=>!Number.isFinite(h)||h<0)||grid.surfaceHeights.some(h=>h!==null&&(!Number.isFinite(h)||h<0)))throw Error(`Grille invalide : ${key}`);
 minMeasured=Math.min(minMeasured,grid.lidar_samples);maxHeight=Math.max(maxHeight,grid.heights.reduce((a,b)=>Math.max(a,b),0));
 const subtree=JSON.parse(await readFile(new URL(stem+'.tiles.json',dir),'utf8')).root;
 if(subtree.children.length!==4||subtree.children.some(t=>t.children.length!==1))throw Error(`LOD incomplet : ${key}`);
 for(const [name,size]of [[stem+'.jpg',1024],[stem+'-2048.jpg',2048],...Array.from({length:4},(_,q)=>[`${stem}-q${q}.jpg`,1024])]){const image=await sharp(await readFile(new URL(name,dir))).metadata();if(image.width!==size||image.height!==size)throw Error(`Photo invalide : ${name}`);}
}
console.log(`${COAST_KEYS.size} tuiles complètes, relief et photos validés ; minimum ${minMeasured} points LiDAR par tuile, hauteur maximale ${maxHeight} m.`);
