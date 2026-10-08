import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export function pwaAssets(publicDir){
 const files=[];
 const walk=(dir,prefix='')=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())walk(join(dir,entry.name),name+'/');else files.push(name);}};
 walk(publicDir);files.sort();const hash=createHash('sha256');for(const file of files)hash.update(file).update(readFileSync(join(publicDir,file)));
 return{version:hash.digest('hex').slice(0,20),assets:['/',...files.filter(file=>!['index.html','sw.js','cache-store.js'].includes(file)).map(file=>'/'+file)]};
}
export function renderWorker(source,config){return source.replace("'__GABIAN_VERSION__'",JSON.stringify(config.version)).replace("'__GABIAN_ASSETS__'",JSON.stringify(config.assets));}
