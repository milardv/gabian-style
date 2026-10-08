import test from 'node:test';
import assert from 'node:assert/strict';
import {toLocal,toGeo,tileAt,tileBounds,inPolygons,sampleGrid} from '../public/flight/geo.js';
import {createFlight,stepFlight} from '../public/flight/physics.js';
import {buildGeometry} from '../public/flight/buildings.js';
const simulate=(state,input,seconds,env={})=>{for(let i=0;i<seconds*120;i++)stepFlight(state,input,1/120,env);return state;};
test('Projection Marseille et tuiles géographiques',()=>{for(const p of [[5.37,43.29],[5.42,43.21]]){const q=toGeo(...toLocal(...p));assert.ok(Math.abs(p[0]-q[0])<1e-9&&Math.abs(p[1]-q[1])<1e-9);const b=tileBounds(...tileAt(...p));assert.ok(p[0]>=b[0]&&p[0]<b[2]&&p[1]>=b[1]&&p[1]<b[3]);}});
test('Limites communales et trous de polygones',()=>{const polys=[[[[0,0],[10,0],[10,10],[0,10]],[[3,3],[7,3],[7,7],[3,7]]]];assert.equal(inPolygons(2,2,polys),true);assert.equal(inPolygons(5,5,polys),false);assert.equal(inPolygons(11,2,polys),false);});
test('Interpolation du relief',()=>assert.equal(sampleGrid({bounds:[0,0,10,10],size:2,heights:[0,10,10,20]},5,5),10));
test('Virages symétriques et consigne de vitesse',()=>{const a=simulate(createFlight(0,0,1000,0),{turn:1,targetSpeed:16},6),b=simulate(createFlight(0,0,1000,0),{turn:-1,targetSpeed:16},6);assert.ok(a.heading>0&&b.heading<0);assert.ok(Math.abs(a.heading+b.heading)<1e-8);const cruise=simulate(createFlight(0,0,1000),{targetSpeed:20},30);assert.ok(Math.abs(cruise.speed-20)<.2);});
test('Plané et faible vitesse perdent de l’altitude',()=>{const a=simulate(createFlight(0,0,1000),{glide:true},15);assert.ok(a.altitude<995);assert.equal(a.thrust,0);const b=createFlight(0,0,1000);b.speed=4;stepFlight(b,{glide:true},1/120);assert.equal(b.stalled,true);assert.ok(b.climb<0);});
test('Confinement et collision avec les bâtiments',()=>{const a=createFlight(0,0,100,Math.PI/2);stepFlight(a,{},1,{contains:()=>false});assert.equal(a.x,0);assert.equal(a.boundaryHit,true);const b=createFlight(0,0,5);stepFlight(b,{},1/120,{surface:()=>20});assert.equal(b.collided,true);assert.equal(b.altitude,21.2);});
test('Volumes 3D : emprise, hauteur et toit orienté vers le ciel',()=>{const b={id:'a',rings:[[[0,0],[10,0],[10,10],[0,10],[0,0]]],center:[5,5],base:2,roof:12,height:10};const g=buildGeometry([b],{bounds:[0,0,10,10],size:2,heights:[2,2,2,2]});assert.equal(g.collisionRoofs[0],12);assert.equal(g.sides.length,72);assert.equal(g.roofs.length,18);const p=g.roofs;const y=(p[5]-p[2])*(p[6]-p[0])-(p[3]-p[0])*(p[8]-p[2]);assert.ok(y>0);});

test('Nitro dépasse le boost et ralentit progressivement après coupure',()=>{
 const boost=simulate(createFlight(0,0,5000),{boost:true,targetSpeed:62},20);
 const nitro=simulate(createFlight(0,0,5000),{nitro:true,targetSpeed:14},20);
 assert.ok(nitro.speed>boost.speed*1.4);
 assert.ok(nitro.speed>95&&nitro.speed<=110);
 assert.equal(nitro.nitro,true);
 const before=nitro.speed;stepFlight(nitro,{targetSpeed:14},1/120);
 assert.ok(nitro.speed<before&&nitro.speed>before-1);
 assert.equal(nitro.nitro,false);
 simulate(nitro,{targetSpeed:14},40);assert.ok(Math.abs(nitro.speed-14)<.5);
});
test('Le nitro fournit une poussée même en mode plané',()=>{
 const state=simulate(createFlight(0,0,5000),{nitro:true,glide:true},10);
 assert.ok(state.speed>90);assert.ok(state.thrust>0);assert.ok(Number.isFinite(state.altitude));
});
