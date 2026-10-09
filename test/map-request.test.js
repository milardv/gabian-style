import test from 'node:test';
import assert from 'node:assert/strict';
import {mapJSON} from '../public/flight/map-request.js';
test('Calanques launch recovers from a dropped terrain request and temporary upstream failure',async()=>{
 let calls=0;const sleeps=[];
 const value=await mapJSON('/api/marseille/terrain/16877/12014?v=8',{fetcher:async()=>{calls++;if(calls===1)throw new TypeError('Failed to fetch');if(calls===2)return new Response('',{status:503});return Response.json({size:513});},delay:async ms=>sleeps.push(ms)});
 assert.equal(value.size,513);assert.equal(calls,3);assert.deepEqual(sleeps,[750,1500]);
});
test('persistent network failure stays bounded and provides an actionable French message',async()=>{
 let calls=0;await assert.rejects(mapJSON('/terrain',{fetcher:async()=>{calls++;throw new TypeError('Failed to fetch');},delay:async()=>{}}),/Connexion.*Repartir/);assert.equal(calls,3);
});
test('invalid tile and invalid JSON are not silently retried',async()=>{
 let calls=0;await assert.rejects(mapJSON('/bad',{fetcher:async()=>{calls++;return new Response('',{status:400});},delay:async()=>{}}),/400/);assert.equal(calls,1);
 await assert.rejects(mapJSON('/bad-json',{fetcher:async()=>new Response('{'),delay:async()=>{}}),SyntaxError);
});
