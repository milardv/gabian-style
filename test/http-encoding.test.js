import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptsGzip} from '../lib/http-encoding.js';
test('compressed terrain and models honor gzip quality and explicit refusal',()=>{
 for(const header of ['gzip','br, gzip;q=0.5','GZIP; q=1','*;q=0.2'])assert.equal(acceptsGzip(header),true,header);
 for(const header of [undefined,'','br','gzip;q=0','gzip;q=0.0','gzip;q=0, *;q=1','*;q=0'])assert.equal(acceptsGzip(header),false,header);
});
