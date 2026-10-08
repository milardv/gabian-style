import test from 'node:test';
import assert from 'node:assert/strict';
import {Exploration,passesLandmark,explorationBadge} from '../public/flight/exploration.js';
const place={name:'Notre-Dame de la Garde',kind:'Basilique',x:0,z:0,ground:150,height:200};
const position=(x,z=0,altitude=250)=>({x,z,altitude});
const memoryStorage=()=>{let value=null;return{getItem:()=>value,setItem:(_,v)=>value=v};};
test('Visite en passant devant ou au-dessus, sans dépendre d’une étiquette visible',()=>{
 assert.equal(passesLandmark(position(-180),position(180),place),true);
 assert.equal(passesLandmark(position(0,0,500),position(0,0,500),place),true);
 assert.equal(passesLandmark(position(0,0,600),position(0,0,600),place),false);
 assert.equal(passesLandmark(position(0,0,100),position(0,0,100),place),false);
 assert.equal(passesLandmark(position(-180,160),position(180,160),place),false);
 assert.equal(passesLandmark(position(-1000),position(1000),place),false);
});
test('Points uniques, conservation après rechargement et déduplication entre tuiles',()=>{
 const storage=memoryStorage(),exploration=new Exploration(storage);
 assert.equal(exploration.update(position(0),[place]).length,1);assert.equal(exploration.points,100);
 assert.equal(exploration.update(position(0),[{...place,id:'autre-tuile',x:1}]).length,0);
 const reload=new Exploration(storage);assert.equal(reload.count,1);assert.equal(reload.has(place),true);assert.equal(reload.update(position(0),[place]).length,0);
});
test('Un passage rapide valide le lieu même entre deux relevés',()=>{
 const exploration=new Exploration(memoryStorage());exploration.update(position(-180),[place]);
 assert.equal(exploration.count,0);assert.equal(exploration.update(position(180),[place]).length,1);
});
test('Pas de visite sur le trajet d’un changement de départ',()=>{
 const exploration=new Exploration(memoryStorage());exploration.update(position(-180),[place]);exploration.resetPosition();
 assert.equal(exploration.update(position(180),[place]).length,0);
});
test('Stockage bloqué ou corrompu : le jeu continue, carnet disponible en session',()=>{
 const unavailable=new Exploration({getItem(){throw Error();},setItem(){throw Error();}});
 assert.equal(unavailable.update(position(0),[place]).length,1);assert.equal(unavailable.saved,false);
 const corrupt=new Exploration({getItem:()=>'{broken',setItem(){}});assert.equal(corrupt.count,0);
 assert.equal(new Exploration(undefined).saved,false);
});
test('Badges aux étapes 1, 5, 10 et 25',()=>{
 const labels=[0,1,5,10,25].map(explorationBadge);assert.equal(new Set(labels).size,5);assert.equal(explorationBadge(4),explorationBadge(1));assert.equal(explorationBadge(9),explorationBadge(5));
});
