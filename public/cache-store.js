/* Shared by the service worker and its storage tests. */
(() => {
 const MB=1024*1024;
 function budget(estimate={},ownBytes=0){
  if(!Number.isFinite(estimate.quota)||estimate.quota<=0)return 256*MB;
  const available=Math.max(0,estimate.quota-(estimate.usage||0)+ownBytes);
  return Math.floor(Math.max(0,Math.min(1024*MB,estimate.quota*.4,available*.75)));
 }
 class Metadata {
  constructor(indexedDB){this.db=new Promise((resolve,reject)=>{const request=indexedDB.open('gabian-cache',1);request.onupgradeneeded=()=>request.result.createObjectStore('tiles',{keyPath:'url'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async operation(mode,action){const db=await this.db;return new Promise((resolve,reject)=>{const tx=db.transaction('tiles',mode),request=action(tx.objectStore('tiles'));tx.oncomplete=()=>resolve(request.result);tx.onerror=tx.onabort=()=>reject(tx.error);});}
  all(){return this.operation('readonly',store=>store.getAll());}
  put(value){return this.operation('readwrite',store=>store.put(value));}
  delete(url){return this.operation('readwrite',store=>store.delete(url));}
  clear(){return this.operation('readwrite',store=>store.clear());}
 }
 class MapCache {
  constructor(cache,metadata,storage,now=()=>Date.now()){
   Object.assign(this,{cache,metadata,storage,now,entries:new Map(),bytes:0,limit:256*MB,estimatedAt:-Infinity,queue:Promise.resolve()});
   this.ready=this.initialize();
  }
  async initialize(){
   const [records,keys]=await Promise.all([this.metadata.all(),this.cache.keys()]);const urls=new Set(keys.map(key=>key.url));
   for(const record of records){if(urls.has(record.url)){this.entries.set(record.url,record);this.bytes+=record.bytes;}else await this.metadata.delete(record.url);}
   for(const key of keys)if(!this.entries.has(key.url))await this.cache.delete(key);
  }
  serialize(action){const work=this.queue.then(()=>this.ready).then(action);this.queue=work.catch(()=>{});return work;}
  async estimate(){
   if(this.now()-this.estimatedAt>60000){let estimate={};try{estimate=await this.storage?.estimate?.()||{};}catch{}this.limit=budget(estimate,this.bytes);this.estimatedAt=this.now();}
   return this.limit;
  }
  async remove(record){await this.cache.delete(record.url);await this.metadata.delete(record.url);this.entries.delete(record.url);this.bytes-=record.bytes;}
  async trim(target,count=4000,exclude){
   const oldest=[...this.entries.values()].filter(record=>record.url!==exclude).sort((a,b)=>a.used-b.used);
   for(const record of oldest){if(this.bytes<=target&&this.entries.size<count)break;await this.remove(record);}
  }
  async get(url){
   await this.ready;const response=await this.cache.match(url),record=this.entries.get(url);
   if(!response)return null;
   const used=this.now();
   if(record&&used-record.used>30000){record.used=used;const updated={...record};this.serialize(()=>this.metadata.put(updated)).catch(()=>{});}
   return{response,updated:record?.updated||0};
  }
  put(url,response){return this.serialize(async()=>{
   if(!response.ok||response.type==='opaque')return;
   const bytes=(await response.clone().arrayBuffer()).byteLength,limit=await this.estimate();
   if(bytes>limit||bytes>32*MB)return;
   const old=this.entries.get(url);await this.trim(Math.max(0,limit-bytes+(old?.bytes||0)),4000,url);
   try{await this.cache.put(url,response.clone());}
   catch(error){
    if(error.name!=='QuotaExceededError')return;
    // Free a meaningful chunk, then retry once. A full phone must not stop the game.
    await this.trim(Math.max(0,this.bytes-Math.max(bytes,limit*.2)),4000,url);
    try{await this.cache.put(url,response.clone());}catch{return;}
   }
   const record={url,bytes,used:this.now(),updated:this.now()};
   try{await this.metadata.put(record);}catch{await this.cache.delete(url);if(old){this.entries.delete(url);this.bytes-=old.bytes;}return;}
   this.bytes+=bytes-(old?.bytes||0);this.entries.set(url,record);
  });}
  clear(){return this.serialize(async()=>{for(const key of await this.cache.keys())await this.cache.delete(key);await this.metadata.clear();this.entries.clear();this.bytes=0;});}
  stats(){return this.serialize(async()=>({bytes:this.bytes,count:this.entries.size,limit:await this.estimate()}));}
 }
 globalThis.GabianCache={budget,Metadata,MapCache};
})();
