export function cacheMessage(win,type){
 return new Promise((resolve,reject)=>{
  const controller=win.navigator.serviceWorker?.controller;if(!controller){resolve(null);return;}
  const channel=new win.MessageChannel(),timer=win.setTimeout(()=>{channel.port1.close();reject(Error('Délai de cache dépassé'));},10000);
  channel.port1.onmessage=event=>{win.clearTimeout(timer);channel.port1.close();resolve(event.data);};
  controller.postMessage({type},[channel.port2]);
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
  const status=doc.getElementById?.('cache-status'),persist=doc.getElementById?.('persist-cache'),clear=doc.getElementById?.('clear-map-cache'),update=doc.getElementById?.('pwa-update');
  const describe=async()=>{
   if(!status)return;
   try{const stats=await cacheMessage(win,'CACHE_STATS');if(stats&&!stats.error)status.textContent=`${Math.round(stats.bytes/1048576)} Mo en cache · ${stats.count} zones/fichiers · limite ${Math.round(stats.limit/1048576)} Mo.`;}catch{}
  };
  doc.addEventListener?.('click',event=>{const toggle=event.target.closest?.('#panel-toggle');if(toggle?.getAttribute('aria-expanded')==='true')describe();});
  if(persist){persist.disabled=!win.navigator.storage?.persist;persist.onclick=async()=>{
   persist.disabled=true;
   try{const durable=await win.navigator.storage.persist();if(status)status.textContent=durable?'Conservation durable autorisée. Les zones parcourues restent sur cet appareil.':'Cache actif. Sa conservation dépend du navigateur et de l’espace disponible.';}
   catch{if(status)status.textContent='Cache actif ; conservation durable indisponible dans ce navigateur.';}
   finally{persist.disabled=false;}
  };}
  if(clear)clear.onclick=async()=>{
   clear.disabled=true;
   try{const result=await cacheMessage(win,'CLEAR_MAP_CACHE');if(status)status.textContent=result&&!result.error?'Cache de la carte vidé. Tes souvenirs sont conservés.':'Cache indisponible pour le moment.';}
   catch{if(status)status.textContent='Cache indisponible pour le moment.';}
   finally{clear.disabled=false;}
  };
  let registration,reloading=false;
  const offerUpdate=()=>{if(update)update.hidden=!registration?.waiting;};
  if(update)update.onclick=()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}};
  win.navigator.serviceWorker.addEventListener?.('controllerchange',()=>{if(reloading)win.location.reload();else describe();});
  const register=()=>win.navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(value=>{
   registration=value;offerUpdate();describe();
   registration.addEventListener?.('updatefound',()=>registration.installing?.addEventListener('statechange',offerUpdate));
  }).catch(()=>{});
  if(doc.readyState==='complete')register();else win.addEventListener('load',register,{once:true});
 }
}
if(typeof window!=='undefined')setupPwa(window,document);
