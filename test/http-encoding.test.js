import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptsGzip,gzipStatic} from '../lib/http-encoding.js';
test('compressed terrain and models honor gzip quality and explicit refusal',()=>{
 for(const header of ['gzip','br, gzip;q=0.5','GZIP; q=1','*;q=0.2'])assert.equal(acceptsGzip(header),true,header);
 for(const header of [undefined,'','br','gzip;q=0','gzip;q=0.0','gzip;q=0, *;q=1','*;q=0'])assert.equal(acceptsGzip(header),false,header);
});
test('uncompressed text assets are gzipped once per file version',()=>{
 let reads=0,mtimeMs=1;const read=()=>{reads++;return Buffer.alloc(4096,'a');},stat=()=>({size:4096,mtimeMs}),gzip=raw=>Buffer.from('z'+raw.length);
 assert.equal(gzipStatic('/x.png','.png',read,stat,gzip),null);
 assert.equal(String(gzipStatic('/a.js','.js',read,stat,gzip)),'z4096');gzipStatic('/a.js','.js',read,stat,gzip);assert.equal(reads,1);
 mtimeMs=2;gzipStatic('/a.js','.js',read,stat,gzip);assert.equal(reads,2);
 assert.equal(gzipStatic('/b.js','.js',read,()=>({size:200,mtimeMs}),gzip),null);
});
