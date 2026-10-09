import test from 'node:test';
import assert from 'node:assert/strict';
import {containsPlayArea,MARSEILLE_WATER_ZONE} from '../public/flight/play-area.js';
import {CityWorld} from '../public/flight/world.js';
import {toLocal,localBounds} from '../public/flight/geo.js';
const boundary={bounds:localBounds([5.20,43.16,5.57,43.43]),polygons:[]};
test('Malmousque, Fausse-Monnaie and Corniche remain in the coastal play area without a municipal land polygon',()=>{
 for(const point of [[5.3471,43.2805],[5.35315,43.2789],[5.3495,43.2848],[5.355395,43.290628],[5.371868,43.261952]])assert.equal(containsPlayArea(...toLocal(...point),boundary),true);
});
test('play area is independent of loaded terrain and retains actual geographic limits',()=>{
 const position=toLocal(5.35315,43.2789);
 for(const height of [0,2.99,3.81,15.12,30])assert.equal(CityWorld.prototype.contains.call({boundary,waterZone:MARSEILLE_WATER_ZONE,ground:()=>height},...position),true);
 for(const point of [[5.15,43.28],[5.60,43.28],[5.35,43.45]])assert.equal(containsPlayArea(...toLocal(...point),boundary),false);
 assert.equal(containsPlayArea(NaN,0,boundary),false);assert.equal(containsPlayArea(0,0,null),false);
});
test('inland municipality remains playable while uncovered inland positions remain excluded',()=>{
 const local={bounds:[-100,-100,100,100],polygons:[[[[-10,-10],[10,-10],[10,10],[-10,10]]]]};
 const sea=[[-80,20],[-20,20],[-20,80],[-80,80]];
 assert.equal(containsPlayArea(0,0,local,sea),true);
 assert.equal(containsPlayArea(-50,50,local,sea),true);
 assert.equal(containsPlayArea(50,50,local,sea),false);
});
