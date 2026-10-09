import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGeometry} from '../public/flight/buildings.js';
import {measuredRoofHeight} from '../public/flight/measured-roofs.js';
const building=()=>({id:'a',rings:[[[0,0],[16,0],[16,16],[0,16],[0,0]]],center:[8,8],base:0,roof:10,height:10});
function terrain(){return {bounds:[0,0,16,16],size:17,heights:Array(289).fill(0),surfaceHeights:Array.from({length:289},(_,i)=>10+4*(1-Math.abs(i%17-8)/8))};}
test('MNS roof retains the measured ridge, footprint, texture UVs and collision clearance',()=>{
 const grid=terrain(),g=buildGeometry([building()],grid),h=[];for(let i=1;i<g.roofs.length;i+=3)h.push(g.roofs[i]);
 assert.equal(Math.max(...h),14);assert.equal(Math.min(...h),10);assert.equal(g.collisionRoofs[0],14);assert.equal(g.roofUvs.length,g.roofs.length/3*2);
 assert.ok(g.roofs.length>18&&g.roofs.length<=18*64);assert.ok(grid.heights.every(v=>v===0));
 for(let i=0;i<g.roofs.length;i+=9){const p=g.roofs;assert.ok((p[i+5]-p[i+2])*(p[i+6]-p[i])-(p[i+3]-p[i])*(p[i+8]-p[i+2])>0);}
});
test('missing data, out-of-tile points and tree-height outliers preserve the existing roof',()=>{
 const grid=terrain();grid.surfaceHeights.fill(null);assert.equal(measuredRoofHeight(grid,[8,8],10,20),10);
 grid.surfaceHeights.fill(60);assert.equal(measuredRoofHeight(grid,[8,8],10,20),10);
 grid.surfaceHeights.fill(14);assert.equal(measuredRoofHeight(grid,[18,8],10,20),10);
 delete grid.surfaceHeights;assert.equal(buildGeometry([building()],grid).roofs.length,18);
});
