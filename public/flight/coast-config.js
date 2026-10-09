export const COAST_DIR='/geodata/corniche-v2/';
export const COAST_URL=COAST_DIR+'tileset.json';
export const COAST_TERRAIN_VERSION=7;
export function coastAssets(key){const stem=key.replace('/','-');return [COAST_URL,COAST_DIR+stem+'.jpg',COAST_DIR+stem+'-8.glb',...Array.from({length:4},(_,q)=>[COAST_DIR+`${stem}-q${q}.jpg`,...[2,1].map(s=>COAST_DIR+`${stem}-q${q}-${s}.glb`)]).flat()];}
export const COAST_KEYS=new Set(['16870/12005','16871/12005','16871/12004','16869/12014','16870/12014','16877/12014']);
