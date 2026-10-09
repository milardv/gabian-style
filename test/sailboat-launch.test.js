import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestSailboatLaunch} from '../public/flight/sailboat-launch.js';
import {clearHull} from '../public/flight/sailboat-recovery.js';
import {angleDelta,WIND_DIRECTION} from '../public/flight/sailboat-physics.js';

test('switching above open sea keeps the player at the same location',async()=>{
 const origin={x:735,z:-920,heading:1.2},env={isWater:()=>true,maxDistance:100,wind:8};
 const spot=await nearestSailboatLaunch(origin,env);
 assert.equal(spot.x,origin.x);assert.equal(spot.z,origin.z);assert.equal(spot.distance,0);
 assert.ok(Math.abs(angleDelta(spot.heading,WIND_DIRECTION+Math.PI))>=50*Math.PI/180);
});
test('switching inland chooses the nearer shore with clearance for the hull',async()=>{
 const env={isWater:(x,z)=>x>103||z<-500,maxDistance:600,wind:0};
 const spot=await nearestSailboatLaunch({x:0,z:0,heading:0},env);
 assert.ok(spot.x>103);assert.ok(spot.distance<=120);assert.ok(clearHull(spot.x,spot.z,spot.heading,env));
});
test('unknown sea is prepared before placement, and rejected water stays unavailable',async()=>{
 let ready=false,loads=0;const env={isWater:x=>x>40?(ready?true:null):false,maxDistance:200,prepare:async()=>{loads++;ready=true;}};
 const spot=await nearestSailboatLaunch({x:0,z:0},env);assert.ok(spot);assert.equal(loads,1);assert.ok(spot.distance<=60);
 assert.equal(await nearestSailboatLaunch({x:0,z:0},{isWater:()=>false,maxDistance:100}),null);
 assert.equal(await nearestSailboatLaunch({x:0,z:0},{isWater:()=>true,contains:()=>false,maxDistance:100}),null);
});
