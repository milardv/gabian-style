import {toLocal} from './geo.js';
export const LIFE_SCENES=[
 {id:'ferry',name:'Le ferry-boat du Vieux-Port',kind:'Scène de vie',coordinates:[5.37315,43.29465],radius:230,reply:'Oh ! Le capitaine et les passagers te saluent.'},
 {id:'petanque',name:'La partie de pétanque à Borély',kind:'Scène de vie',coordinates:[5.3793,43.2578],radius:150,reply:'Oh, le gabian ! Tu touches pas au cochonnet !'},
 {id:'market',name:'Les étals de Noailles',kind:'Scène de vie',coordinates:[5.3790,43.2961],radius:180,reply:'Oh ! Les marchands de Noailles lèvent la tête.'},
 {id:'apero',name:'L’apéro de la Corniche',kind:'Scène de vie',coordinates:[5.3528,43.2838],radius:160,reply:'À la tienne, le gabian ! Une tablée te fait signe.'},
 {id:'supporters',name:'Le cortège bleu et blanc',kind:'Scène de vie',coordinates:[5.39555,43.2732],radius:240,reply:'Allez l’OM ! Le cortège répond à ton cri.'},
 {id:'panier',name:'Les toits et le linge du Panier',kind:'Scène de vie',coordinates:[5.3677,43.3001],radius:180,reply:'Oh, doucement ! Les gabians du Panier viennent te voir.'},
 {id:'sardine',name:'La sardine qui bouche le port',kind:'Surprise de Marseille',coordinates:[5.3692,43.2948],radius:320,reply:'Peuchère ! Même la sardine te fait un clin d’œil.'},
 {id:'divers',name:'Les plongeurs de la Corniche',kind:'Scène de vie',coordinates:[5.35047505,43.28537954],waterCoordinates:[5.35020,43.28552],roadHeight:15.5,radius:190,reply:'Oh fan, quel salto ! Les copains applaudissent.'},
 {id:'prado',name:'Les merguez du Prado',kind:'Scène de vie',coordinates:[5.3732,43.2603],radius:240,reply:'Ça grille au Prado ! Les familles te font signe.'},
 {id:'prado-sud',name:'Le barbecue des familles à la plage',kind:'Scène de vie',coordinates:[5.37485,43.25645],radius:230,reply:'À table ! Les merguez sont prêtes.'}
].map(item=>{const [x,z]=toLocal(...item.coordinates);return{...item,x,z,center:[x,z],visitKey:`marseille-life:${item.id}`};});
export function ferryProgress(time){const cycle=((time%160)+160)%160;return cycle<15?0:cycle<75?(cycle-15)/60:cycle<95?1:cycle<155?1-(cycle-95)/60:0;}
export function sardineActive(time,delay){return time>=delay&&(time-delay)%480<85;}
export function nearbyReaction(position,scenes=LIFE_SCENES,sardine=false){return scenes.filter(item=>item.id!=='sardine'||sardine).map(item=>({...item,distance:Math.hypot(item.x-position.x,item.z-position.z)})).filter(item=>item.distance<=item.radius&&Math.abs(position.altitude-(item.height??item.ground??0))<200).sort((a,b)=>a.distance-b.distance)[0]||null;}
export function coastalUpdraft(position,wind){if(wind<3)return 0;const coast=LIFE_SCENES.find(s=>s.id==='apero'),distance=Math.hypot(position.x-coast.x,position.z-coast.z);return Math.max(0,1-distance/420)*Math.min(2.4,wind*.24);}
