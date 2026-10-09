export function cacheMessage(win,type){
 return new Promise((resolve,reject)=>{
  const controller=win.navigator.serviceWorker?.controller;if(!controller){resolve(null);return;}
  const channel=new win.MessageChannel(),timer=win.setTimeout(()=>{channel.port1.close();reject(Error('Délai de cache dépassé'));},10000);
  channel.port1.onmessage=event=>{win.clearTimeout(timer);channel.port1.close();resolve(event.data);};
  controller.postMessage({type},[channel.port2]);
 });
}
// Give the first visit a chance to cache the very first geographic requests.
// Cache failures or a slow installation must never prevent the game starting.
export function waitForCache(win, timeout=4000){
 const worker=win.navigator.serviceWorker;
 if(!win.isSecureContext||!worker||worker.controller)return Promise.resolve();
 return new Promise(resolve=>{
  const ready=()=>{if(worker.controller)finish();};
  const finish=()=>{win.clearTimeout(timer);worker.removeEventListener?.('controllerchange',ready);resolve();};
  const timer=win.setTimeout(finish,timeout);
  worker.addEventListener('controllerchange',ready);
  worker.ready?.then(ready).catch(()=>{});
 });
}
export function setupPwa(win,doc){
 const buttons=[...doc.querySelectorAll('[data-install]')],help=[...doc.querySelectorAll('[data-install-help]')];
 const standalone=win.matchMedia('(display-mode: standalone)');let prompt=null,installed=false;
 const sync=()=>{for(const button of buttons)button.hidden=installed||standalone.matches||!!win.navigator.standalone;};
 const explain=text=>help.forEach(el=>{el.textContent=text;el.hidden=false;});
 win.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;sync();});
 win.addEventListener('appinstalled',()=>{installed=true;prompt=null;sync();help.forEach(el=>el.hidden=true);});
 standalone.addEventListener('change',sync);
 for(const button of buttons)button.onclick=async()=>{
  if(prompt){
   const invitation=prompt;prompt=null;buttons.forEach(el=>el.disabled=true);
   try{await invitation.prompt();await invitation.userChoice;}
   catch{explain('Ouvre le menu du navigateur puis choisis Installer l’application ou Ajouter à l’écran d’accueil.');}
   finally{buttons.forEach(el=>el.disabled=false);sync();}
  }else{
   const ios=/iPad|iPhone|iPod/.test(win.navigator.userAgent)||(win.navigator.platform==='MacIntel'&&win.navigator.maxTouchPoints>1);
   explain(ios?'Dans Safari : Partager → Sur l’écran d’accueil, puis Ajouter.':'Ouvre le menu du navigateur puis choisis Installer l’application ou Ajouter à l’écran d’accueil, si proposé.');
  }
 };
 sync();
 if(win.isSecureContext&&'serviceWorker' in win.navigator){
  const statuses=[...doc.querySelectorAll('[data-cache-status]')],clearButtons=[...doc.querySelectorAll('[data-clear-map-cache]')],updates=[...doc.querySelectorAll('[data-pwa-update]')];
  let durable=false,persisting;
  const report=text=>statuses.forEach(status=>status.textContent=text);
  const describe=async()=>{
   try{const stats=await cacheMessage(win,'CACHE_STATS');if(stats&&!stats.error)report(`Cache actif${durable?' · conservation durable':''} · ${Math.round(stats.bytes/1048576)} Mo · ${stats.count} zones/fichiers · limite ${Math.round(stats.limit/1048576)} Mo.`);}catch{}
  };
  const requestPersistence=()=>{
   if(durable||!win.navigator.storage?.persist)return Promise.resolve();
   if(!persisting)persisting=(async()=>{
    try{durable=await win.navigator.storage.persisted?.()||await win.navigator.storage.persist();}
    catch{/* Ordinary caching remains active if persistence is unsupported or refused. */}
    report(durable?'Cache actif · conservation durable autorisée.':'Cache actif automatiquement. Sa conservation dépend du navigateur et de l’espace disponible.');
    await describe();
   })().finally(()=>{persisting=null;});
   return persisting;
  };
  // Some browsers grant persistence only after a trusted interaction.
  const retryPersistence=()=>{win.removeEventListener?.('pointerdown',retryPersistence);win.removeEventListener?.('keydown',retryPersistence);requestPersistence();};
  if(win.navigator.storage?.persist){win.addEventListener('pointerdown',retryPersistence,{once:true});win.addEventListener('keydown',retryPersistence,{once:true});}
  doc.addEventListener?.('click',event=>{const toggle=event.target.closest?.('#panel-toggle');if(toggle?.getAttribute('aria-expanded')==='true')describe();});
  for(const clear of clearButtons)clear.onclick=async()=>{
   clearButtons.forEach(button=>button.disabled=true);
   try{const result=await cacheMessage(win,'CLEAR_MAP_CACHE');report(result&&!result.error?'Cache de la carte vidé. Le cache reste actif et tes souvenirs sont conservés.':'Cache indisponible pour le moment.');}
   catch{report('Cache indisponible pour le moment.');}
   finally{clearButtons.forEach(button=>button.disabled=false);}
  };
  let registration,reloading=false;
  const offerUpdate=()=>updates.forEach(update=>update.hidden=!registration?.waiting);
  for(const update of updates)update.onclick=()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}};
  win.navigator.serviceWorker.addEventListener?.('controllerchange',()=>{if(reloading)win.location.reload();else describe();});
  const register=()=>win.navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(value=>{
   registration=value;offerUpdate();describe();requestPersistence();
   registration.addEventListener?.('updatefound',()=>registration.installing?.addEventListener('statechange',offerUpdate));
  }).catch(()=>{});
  register();
 }
}
export const cacheReady=typeof window!=='undefined'?waitForCache(window):Promise.resolve();
if(typeof window!=='undefined')setupPwa(window,document);
