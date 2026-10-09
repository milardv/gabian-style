const STAGES={cache:'Ouverture du cache local…',boundary:'Chargement des limites de Marseille…',overview:'Chargement du relief général…',terrain:'Chargement du relief du départ…',buildings:'Chargement des bâtiments du départ…',geometry:'Préparation des bâtiments en 3D…',mission:'Préparation de la partie…',ready:'Préparation de la vue…'};
// Counts completed startup stages, not elapsed time or unknown download sizes.
export class LoadingProgress{
 constructor(update){this.update=update;this.done=new Set();this.pending=new Set();this.stopped=false;this.label='Connexion au jeu…';this.emit();}
 stage(id,complete=false){
  if(this.stopped||!Object.hasOwn(STAGES,id)||this.done.has(id))return;
  if(complete){this.done.add(id);this.pending.delete(id);}else this.pending.add(id);
  const active=[...this.pending].at(-1);this.label=active?STAGES[active]:STAGES[id];
  if(this.done.size===Object.keys(STAGES).length){this.label='Marseille est prête. À toi de jouer !';this.stopped=true;}
  this.emit();
 }
 fail(message){if(this.stopped)return;this.pending.clear();this.stopped=true;this.label=message;this.emit(true);}
 emit(error=false){this.update({percent:Math.round(this.done.size/Object.keys(STAGES).length*100),label:this.label,error});}
}
export function showLoadingProgress({percent,label,error},bar,number,status){
 number.textContent=`${percent} %`;bar.setAttribute('aria-valuenow',String(percent));bar.setAttribute('aria-valuetext',`${percent} % · ${label}`);bar.dataset.state=error?'error':percent===100?'ready':'loading';bar.firstElementChild.style.transform=`scaleX(${percent/100})`;status.textContent=label;
}
