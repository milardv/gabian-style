const STORAGE_KEY='gabian-style:visits:v1';
export const landmarkKey=item=>item.visitKey||`${String(item.name).trim().toLocaleLowerCase('fr-FR')}@${Math.round(item.x/20)},${Math.round(item.z/20)}`;
export const explorationBadge=count=>count>=25?'Gabian de légende':count>=10?'Enfant du pays':count>=5?'Habitué de la rade':count>=1?'Premier envol':'À toi Marseille';
export function passesLandmark(previous,current,item){
 const dx=current.x-previous.x,dz=current.z-previous.z,length=dx*dx+dz*dz;
 // Never award landmarks along a teleport (launch or change of vehicle).
 if(length>600*600)return false;
 const t=length?Math.max(0,Math.min(1,((item.x-previous.x)*dx+(item.z-previous.z)*dz)/length)):1;
 const distance=Math.hypot(previous.x+dx*t-item.x,previous.z+dz*t-item.z);
 const altitude=previous.altitude+(current.altitude-previous.altitude)*t;
 return distance<=130&&altitude<=(item.height??item.ground??0)+350&&altitude>=(item.ground??0)-10;
}
export class Exploration {
 constructor(storage){this.storage=storage;this.visits=new Map();this.saved=!!storage;this.previous=null;
  try{const data=JSON.parse(storage?.getItem(STORAGE_KEY)||'[]');if(Array.isArray(data))for(const item of data.slice(0,5000))if(item&&typeof item.key==='string'&&typeof item.name==='string')this.visits.set(item.key,item);}catch{this.saved=false;}
 }
 has(item){return this.visits.has(landmarkKey(item));}
 get count(){return this.visits.size;}
 get points(){return this.count*100;}
 resetPosition(){this.previous=null;}
 update(position,landmarks){const current={x:position.x,z:position.z,altitude:position.altitude},previous=this.previous||current,rewards=[];
  for(const item of landmarks){if(this.has(item)||!passesLandmark(previous,current,item))continue;
   const visit={key:landmarkKey(item),name:item.name,kind:item.kind||'Lieu remarquable'};this.visits.set(visit.key,visit);rewards.push(visit);
  }this.previous=current;
  if(rewards.length){try{if(!this.storage)throw Error('Stockage indisponible');this.storage.setItem(STORAGE_KEY,JSON.stringify([...this.visits.values()]));this.saved=true;}catch{this.saved=false;}}
  return rewards;
 }
}
