importScripts('/cache-store.js');
// Filled from a hash of public files by the Node server at each deployment.
const VERSION='__GABIAN_VERSION__';
const ASSETS='__GABIAN_ASSETS__';
const SHELL=`gabian-shell-${VERSION}`,MAP='gabian-map-v1',FALLBACK='/offline.html';
// Keep MAP across app upgrades. Bump its version only if the data format changes.
let maps;
function mapCache(){
 if(!maps)maps=caches.open(MAP).then(cache=>new GabianCache.MapCache(cache,new GabianCache.Metadata(self.indexedDB),self.navigator.storage)).catch(()=>null);
 return maps;
}
const inFlight=new Map();
const safe=promise=>promise.catch(()=>{});
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(SHELL).then(async cache=>{for(const asset of ASSETS){const key=asset+'?build='+VERSION,response=await fetch(key,{cache:'reload'});if(!response.ok||response.headers.get('X-Gabian-Version')!==VERSION)throw Error('Déploiement incomplet');await cache.put(key,response);}}));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('gabian-shell-')&&key!==SHELL)||key.startsWith('gabian-offline-')).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
function mapResource(path){return /^\/api\/marseille\/(boundary|overview|overview-imagery)$/.test(path)||/^\/api\/marseille\/(terrain|buildings|roads|imagery)\/\d{1,5}\/\d{1,5}$/.test(path);}
function download(request,key,store){
 if(!inFlight.has(key)){
  const pending=fetch(request).then(async response=>{const type=response.headers.get('Content-Type')||'',image=/imagery/.test(new URL(request.url).pathname);if(response.ok&&store&&(image?type.startsWith('image/'):type.includes('application/json')))await safe(store.put(key,response));return response;}).finally(()=>inFlight.delete(key));
  inFlight.set(key,pending);
 }
 return inFlight.get(key).then(response=>response.clone());
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(mapResource(url.pathname)){
  url.searchParams.sort();const key=url.href;
  // waitUntil starts synchronously and covers writes/refresh after an instant cache hit.
  const result=mapCache().then(async store=>{
   let cached;try{cached=await store?.get(key);}catch{}
   const ttl=/imagery/.test(url.pathname)?90*86400000:30*86400000;
   if(cached){const refresh=Date.now()-cached.updated>ttl?safe(download(request,key,store)):Promise.resolve();return{response:cached.response,background:Promise.all([refresh,store.queue])};}
   return{response:await download(request,key,store),background:Promise.resolve()};
  });
  event.respondWith(result.then(value=>value.response));event.waitUntil(safe(result.then(value=>value.background)));return;
 }
 const navigation=request.mode==='navigate'&&['/','/marseille','/marseille/','/index.html'].includes(url.pathname);
 const asset=ASSETS.includes(url.pathname)&&url.pathname!=='/';
 if(navigation||asset){
  event.respondWith(caches.open(SHELL).then(async cache=>{
   const key=navigation?'/':url.pathname,cached=await cache.match(key+'?build='+VERSION);
   if(cached)return cached;
   try{return await fetch(request);}catch{return(await cache.match(FALLBACK+'?build='+VERSION))||new Response('Connexion indisponible.',{status:503});}
  }));
 }
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE'){self.skipWaiting();return;}
 if(!['CACHE_STATS','CLEAR_MAP_CACHE'].includes(event.data?.type))return;
 event.waitUntil(mapCache().then(async store=>{
  if(!store){event.ports[0]?.postMessage({error:'Cache indisponible'});return;}
  if(event.data.type==='CLEAR_MAP_CACHE')await store.clear();event.ports[0]?.postMessage(await store.stats());
 }).catch(()=>event.ports[0]?.postMessage({error:'Cache indisponible'})));
});
