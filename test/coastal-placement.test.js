import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.module.js';
import {COASTAL_SPOTS} from '../public/flight/coastal-spots.js';
import {dryPatch,sunPatches} from '../public/flight/coastal-placement.js';
import {MarseilleLife} from '../public/flight/marseille-life.js';
const flat={ground:()=>0,surface:()=>0,tiles:new Map()},sand=()=>[180,165,130];
test('Littoral : toutes les plages du catalogue municipal et les criques demandées sont présentes',()=>{
 assert.equal(COASTAL_SPOTS.filter(s=>s.id.startsWith('beach-')).length,23);
 assert.equal(new Set(COASTAL_SPOTS.map(s=>s.id)).size,COASTAL_SPOTS.length);
 for(const name of ['Catalans','Prophète','Pointe Rouge','Malmousque','Fausse-Monnaie','Sormiou','Morgiou'])assert.ok(COASTAL_SPOTS.some(s=>s.name.includes(name)),name);
});
test('Placement : éviter eau, bâtiments, fortes pentes et orthophoto absente',()=>{
 assert.equal(dryPatch(flat,0,0,'beach',sand),0);
 assert.equal(dryPatch(flat,0,0,'beach',()=>[25,110,130]),null);
 assert.equal(dryPatch(flat,0,0,'beach',()=>null),null);
 assert.equal(dryPatch({...flat,surface:()=>8},0,0,'beach',sand),null);
 assert.equal(dryPatch({...flat,ground:x=>x*2,surface:x=>x*2},0,0,'rock',()=>[130,130,130]),null);
 assert.equal(dryPatch({...flat,ground:()=>2,surface:()=>2},0,0,'rock',()=>[130,130,130]),2);
 assert.equal(dryPatch(flat,0,0,'beach',()=>[40,110,40]),null);
 assert.equal(dryPatch(flat,0,0,'rock',()=>[40,110,40]),null);
});
test('Petites scènes : nombre limité, serviettes espacées, aucun déplacement vers une zone bleue',()=>{
 const spot={x:0,z:0,terrain:'beach'},shore=(_world,x)=>x>=5?sand():[25,110,130];
 const patches=sunPatches(flat,spot,shore);assert.equal(patches.length,4);assert.ok(patches.every(p=>p.x>=6.5));
 for(let i=0;i<patches.length;i++)for(let j=i+1;j<patches.length;j++)assert.ok(Math.hypot(patches[i].x-patches[j].x,patches[i].z-patches[j].z)>=4);
 assert.equal(sunPatches({...flat,ground:()=>2,surface:()=>2},{...spot,terrain:'rock'},sand).length,2);
 assert.deepEqual(sunPatches(flat,spot,()=>[25,110,130]),[]);
});
test('Rochers : fusion en un seul mesh, adultes seulement, altitude correcte et réutilisation',()=>{
 const world={ground:()=>12,surface:()=>12},life=new MarseilleLife(new T.Scene(),world,()=>{},{sardineDelay:99999});
 const spot=life.scenes.find(s=>s.id==='sun-malmousque'),position={x:spot.x,z:spot.z,altitude:30};
 life.update(0,position,2,false);assert.ok(spot.built);assert.equal(spot.sunbathers.length,2);assert.ok(spot.sunbathers.every(s=>s.age>=18));
 assert.equal(spot.root.children.length,1);assert.ok(spot.root.children[0].isMesh);assert.equal(spot.root.position.y,12);
 const geometry=spot.root.children[0].geometry;assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
 life.update(.1,position,2,true);assert.equal(spot.root.children[0].geometry,geometry);
 life.update(.1,{x:90000,z:90000,altitude:30},2,false);assert.equal(spot.root.visible,false);
});
