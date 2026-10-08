const CACHE='gabian-offline-v1';
const FALLBACK='/offline.html';
// Only a small offline page and its icon. Never cache IGN tiles, API responses,
// or game modules: each online session uses the latest deployed game.
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([FALLBACK,'/icons/icon-192.png'])));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('gabian-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(async response=>{
   if(response.status<500)return response;
   return(await caches.match(FALLBACK))||response;
  }).catch(async()=> (await caches.match(FALLBACK))||new Response('Connexion indisponible. Réessayez avec Internet.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
 }else if(url.pathname==='/icons/icon-192.png'){
  event.respondWith(fetch(request).catch(()=>caches.match('/icons/icon-192.png')));
 }
});
