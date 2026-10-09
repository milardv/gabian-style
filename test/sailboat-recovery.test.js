import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbySailboatRecovery} from '../public/flight/sailboat-recovery.js';
import {createSailboat,stepSailboat,MAX_MISTRAL,WIND_DIRECTION,angleDelta} from '../public/flight/sailboat-physics.js';

test('Reprise : quelques mètres du mur, coque dégagée et cap qui s’en éloigne',()=>{
 const crash=createSailboat(100,200,Math.PI/2);crash.grounded=true;
 const environment={wind:8,isWater:x=>x<102,contains:()=>true},spot=nearbySailboatRecovery(crash,environment);
 assert.ok(spot);assert.equal(spot.distance,4);assert.ok(spot.x<crash.x);assert.ok(Math.sin(spot.heading)<0);
 const boat=createSailboat(spot.x,spot.z,spot.heading);
 for(let i=0;i<240;i++)stepSailboat(boat,{},1/120,environment);
 assert.equal(boat.grounded,false);assert.ok(boat.speed>0);assert.equal(crash.x,100);assert.equal(crash.grounded,true);
});
test('Reprise : contourne un rocher et ne choisit jamais de terre ni une zone inconnue',()=>{
 const crash=createSailboat(0,0,Math.PI/2);
 const env={wind:8,isWater:(x,z)=>Math.hypot(x,z)>4&&x<0,contains:(x,z)=>Math.hypot(x,z)<25},spot=nearbySailboatRecovery(crash,env);
 assert.ok(spot);assert.ok(spot.distance<=24);assert.ok(spot.x<0);
 assert.equal(nearbySailboatRecovery(crash,{isWater:()=>null}),null);
 assert.equal(nearbySailboatRecovery(crash,{isWater:()=>true,contains:()=>false}),null);
 assert.equal(nearbySailboatRecovery(crash,{isWater:()=>false}),null);
});
test('Reprise : ne pointe pas face au mistral, même si le recul se fait vers le nord-ouest',()=>{
 const crash=createSailboat(0,0,WIND_DIRECTION),env={wind:MAX_MISTRAL,isWater:()=>true},spot=nearbySailboatRecovery(crash,env);
 assert.ok(spot);assert.ok(Math.abs(angleDelta(spot.heading,WIND_DIRECTION+Math.PI))>=50*Math.PI/180);
 const boat=createSailboat(spot.x,spot.z,spot.heading);for(let i=0;i<360;i++)stepSailboat(boat,{},1/120,env);assert.ok(boat.speed>0);
});
test('Reprise : distance limitée près du choc et marge sur toute la coque, pas juste son centre',()=>{
 const crash=createSailboat(0,0,0);
 assert.equal(nearbySailboatRecovery(crash,{wind:0,isWater:(x,z)=>Math.hypot(x,z)>40}),null);
 assert.equal(nearbySailboatRecovery(crash,{wind:0,isWater:(x,z)=>Math.abs(x)<.5}),null);
 const spot=nearbySailboatRecovery(crash,{wind:0,isWater:()=>true});assert.equal(spot.distance,4);
});
