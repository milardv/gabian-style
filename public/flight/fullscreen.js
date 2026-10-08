// Rotation alone usually lacks user activation. Retry once on the next touch,
// and respect a voluntary exit until the user rotates again.
export class FullscreenControls {
 constructor(doc,win,buttons,started,onChange,notify){
  Object.assign(this,{doc,win,buttons,started,onChange,notify,pending:false,busy:false,suppressed:false,wasActive:false});
  this.landscape=win.matchMedia('(orientation: landscape)');this.coarse=win.matchMedia('(pointer: coarse)');
  this.supported=!!(doc.documentElement.requestFullscreen||doc.documentElement.webkitRequestFullscreen);
  for(const button of buttons)button.onclick=()=>this.toggle();
  this.landscape.addEventListener('change',()=>this.landscapeChanged());
  doc.addEventListener('fullscreenchange',()=>this.sync());doc.addEventListener('webkitfullscreenchange',()=>this.sync());
  doc.addEventListener('pointerup',e=>{
   if(e.isTrusted&&this.pending&&this.started()&&this.landscape.matches&&!buttons.includes(e.target.closest?.('button'))){this.pending=false;this.enter(false);}
  },true);
  this.sync();
 }
 get active(){return !!(this.doc.fullscreenElement||this.doc.webkitFullscreenElement);}
 sync(){
  const active=this.active;
  if(this.wasActive&&!active){this.suppressed=true;this.pending=false;}
  if(active)this.pending=false;
  this.wasActive=active;
  for(const button of this.buttons){
   button.disabled=!this.supported;button.setAttribute('aria-pressed',active);
   const label=!this.supported?'Plein écran indisponible':active?'Quitter le plein écran':'Plein écran';
   if(!button.querySelector('svg'))button.textContent=label;
   button.title=label;button.setAttribute('aria-label',label);
  }
  this.onChange();
 }
 async enter(manual){
  if(this.active||this.busy)return;
  if(!this.supported){if(manual)this.notify('Ce navigateur ne propose pas le plein écran pour le jeu.');return;}
  this.busy=true;
  try{
   const element=this.doc.documentElement;
   await (element.requestFullscreen?element.requestFullscreen({navigationUI:'hide'}):element.webkitRequestFullscreen());
   this.pending=false;this.sync();
  }catch{
   if(manual)this.notify('Touchez le bouton Plein écran pour réessayer ; le navigateur peut limiter cette option.');
   else this.pending=!this.suppressed&&this.landscape.matches;
  }finally{this.busy=false;}
 }
 async toggle(){
  this.pending=false;
  if(!this.active){this.suppressed=false;return this.enter(true);}
  this.suppressed=true;
  try{await (this.doc.exitFullscreen?this.doc.exitFullscreen():this.doc.webkitExitFullscreen());this.sync();}
  catch{this.notify('Impossible de quitter le plein écran. Utilisez la commande de votre navigateur.');}
 }
 landscapeChanged(starting=false){
  if(!this.landscape.matches){this.pending=false;this.suppressed=false;return;}
  if(!this.coarse.matches||(!this.started()&&!starting))return;
  this.suppressed=false;this.pending=false;
  if(this.landscape.matches&&!this.active){this.pending=true;this.enter(false);}
 }
}
