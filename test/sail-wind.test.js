import test from 'node:test';
import assert from 'node:assert/strict';
import {createSailboat,stepSailboat,MAX_MISTRAL,WIND_DIRECTION,sailingWind,sailTrimTarget} from '../public/flight/sailboat-physics.js';
import {sailWindReading,SailWindIndicator} from '../public/flight/sail-wind.js';
const source=WIND_DIRECTION+Math.PI;
test('Indicateur : provenance du mistral, bâbord / tribord et vent arrière',()=>{
 const s=createSailboat();s.heading=source;
 assert.equal(sailWindReading(s,8).side,'de face');assert.match(sailWindReading(s,8).guidance,/change de cap/);
 s.heading=source-Math.PI/2;assert.equal(sailWindReading(s,8).side,'de tribord (droite)');
 s.heading=source+Math.PI/2;assert.equal(sailWindReading(s,8).side,'de bâbord (gauche)');
 s.heading=source+Math.PI;assert.equal(sailWindReading(s,8).side,'de l’arrière');assert.equal(sailWindReading(s,0).guidance,'Calme plat');
});
test('Indicateur : conseil cohérent avec le trim physique et le vent apparent en mouvement',()=>{
 const s=createSailboat(0,0,source-Math.PI/2);s.vx=2;s.vz=-1;
 const wind=sailingWind(s,8),ideal=sailTrimTarget(wind.angle);s.trim=ideal;
 assert.equal(sailWindReading(s,8).guidance,'Voile bien réglée');assert.equal(sailWindReading(s,8).angle,wind.angle);
 s.trim=ideal+.15;assert.match(sailWindReading(s,8).guidance,/Borde/);s.trim=ideal-.15;assert.match(sailWindReading(s,8).guidance,/Choque/);
 stepSailboat(s,{},1/120,{wind:8});assert.equal(s.windAngle,wind.angle);
});
test('Mistral à 200 km/h : effet réel au-delà de 12 m/s, coque stable dans les virages',()=>{
 const normal=createSailboat(0,0,Math.PI/2),storm=createSailboat(0,0,Math.PI/2);
 for(let i=0;i<90*120;i++){stepSailboat(normal,{},1/120,{wind:12});stepSailboat(storm,{},1/120,{wind:MAX_MISTRAL});}
 assert.ok(storm.speed>normal.speed*1.4);assert.ok(storm.speed<8);assert.ok(storm.apparentWind>45);assert.equal(sailWindReading(storm,MAX_MISTRAL).windKmh,200);
 for(let i=0;i<6000;i++){stepSailboat(storm,{turn:i<3000?1:-1,trim:i%2?.5:-.5},1/120,{wind:MAX_MISTRAL});assert.ok(Object.values(storm).filter(v=>typeof v==='number').every(Number.isFinite));assert.ok(Math.abs(storm.heel)<.6);assert.ok(storm.speed<8);}
});
test('Indicateur : passage du vent arrière sans tour complet, caché hors voilier',()=>{
 const parts=new Map(),attrs={};for(const id of ['needle','strength','side','guide'])parts.set(`[data-wind-${id}]`,{style:{}});parts.set('[data-sail-trim]',{});
 const root={querySelector:q=>parts.get(q),setAttribute:(k,v)=>attrs[k]=v},indicator=new SailWindIndicator(root),s=createSailboat(0,0,source-Math.PI+.01);
 indicator.update(s,8);const angle=indicator.lastAngle;s.heading-=.02;indicator.update(s,8);assert.ok(Math.abs(indicator.lastAngle-angle)<.03);
 assert.match(attrs['aria-label'],/Mistral/);indicator.update(s,0);assert.equal(parts.get('[data-wind-needle]').style.opacity,'0');indicator.setVisible(false);assert.equal(root.hidden,true);
});
