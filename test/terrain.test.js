import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainGeometry, terrainLOD, overviewMask } from '../public/flight/terrain.js';
import { elevationClient, elevationGrid, terrainSize } from '../lib/elevation.js';
import { localBounds, tileAt, tileBounds } from '../public/flight/geo.js';

test('Maire uses the finer IGN grid, urban tiles retain their existing size', () => {
  assert.equal(terrainSize(tileBounds(...tileAt(5.34, 43.21))), 161);
  assert.equal(terrainSize(tileBounds(...tileAt(5.374, 43.295))), 81);
});
test('nearby relief remains at full resolution including mobile tile corners and adjacent cliffs', () => {
  for (const quality of ['mobile', 'balanced', 'high']) {
    assert.equal(terrainLOD([0, 0, 900, 900], [1, 1], quality), 1);
    assert.equal(terrainLOD([900, 0, 1800, 900], [899, 1], quality), 1);
  }
  assert.equal(terrainLOD([3000, 0, 3900, 900], [0, 0], 'mobile'), 8);
});
test('mesh retains measured sharp peaks and includes last row and column at every stride', () => {
  const grid = {size: 6, bounds: [0, 0, 50, 50], heights: Array(36).fill(0)};
  grid.heights[14] = 143;
  const full = terrainGeometry(grid), reduced = terrainGeometry(grid, 4);
  assert.equal(full.attributes.position.getY(14), 143);
  assert.equal(reduced.attributes.position.count, 9);
  assert.equal(reduced.attributes.position.getX(8), 50);
  assert.equal(reduced.attributes.position.getZ(8), 50);
  assert.ok([...reduced.index.array].every(i => i < reduced.attributes.position.count));
});
test('overview coverage survives texture shader recompilation and tile removal', () => {
  const material = {}, update = overviewMask(material);
  update([[0, 0, 900, 900]]);
  const compile = () => {
    const shader = {uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <clipping_planes_fragment>'};
    material.onBeforeCompile(shader);
    return shader;
  };
  const first = compile(), textured = compile();
  assert.equal(first.uniforms.terrainCount, textured.uniforms.terrainCount);
  assert.equal(textured.uniforms.terrainCount.value, 1);
  assert.deepEqual(textured.uniforms.terrainBounds.value[0].toArray(), [0, 0, 900, 900]);
  assert.match(textured.fragmentShader, /overviewPosition.x >= b.x/);
  assert.match(textured.fragmentShader, /discard/);
  update([]);
  assert.equal(first.uniforms.terrainCount.value, 0);
});
test('dense grids use bounded POST batches and preserve point ordering', async () => {
  const bounds = localBounds(tileBounds(...tileAt(5.34, 43.21))), batches = [];
  let offset = 0;
  const grid = await elevationGrid(bounds, 161, async body => {
    batches.push(body);
    const count = body.lon.split('|').length;
    return {elevations: Array.from({length: count}, () => offset++ / 100)};
  });
  assert.equal(batches.length, 7);
  assert.equal(grid.heights.length, 25921);
  assert.equal(grid.heights[25920], 259.2);
  assert.ok(batches.every(b => b.lon.split('|').length <= 4000 && b.delimiter === '|'));
});
test('invalid or incomplete elevation is rejected, IGN sea sentinel is handled explicitly', async () => {
  const bounds = [0, 0, 1, 1];
  await assert.rejects(elevationGrid(bounds, 2, async () => ({elevations: [0]})), /incomplète/);
  await assert.rejects(elevationGrid(bounds, 2, async () => ({elevations: [0, null, 0, 0]})), /invalide/);
  const grid = await elevationGrid(bounds, 2, async () => ({elevations: [143, -99999, 0, 30]}));
  assert.deepEqual(grid.heights, [143, 0, 0, 30]);
});
test('all concurrent tiles share rate limiting, backoff respects Retry-After', async () => {
  let time = 0, attempts = 0;
  const starts = [];
  const request = elevationClient({now: () => time, pause: async ms => { time += ms; }, fetcher: async (_url, options) => {
    assert.equal(options.method, 'POST');
    starts.push(time);
    attempts++;
    return attempts === 1 ? new Response('', {status: 429, headers: {'Retry-After': '2'}}) : Response.json({elevations: [143]});
  }});
  await Promise.all([request({}), request({}), request({})]);
  assert.deepEqual(starts, [0, 2000, 2300, 2600]);
});
test('a failed request does not poison the elevation queue', async () => {
  let attempts = 0;
  const request = elevationClient({pause: async () => {}, fetcher: async () => {
    if (++attempts === 1) throw Error('network');
    return Response.json({elevations: [143]});
  }});
  await assert.rejects(request({}), /network/);
  assert.deepEqual(await request({}), {elevations: [143]});
});
