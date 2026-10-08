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
  const register=()=>win.navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
  if(doc.readyState==='complete')register();else win.addEventListener('load',register,{once:true});
 }
}
if(typeof window!=='undefined')setupPwa(window,document);
