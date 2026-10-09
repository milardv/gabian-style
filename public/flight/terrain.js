import * as T from '../vendor/three/three.core.js';

export function terrainGeometry(grid, stride = 1) {
  const { size: n, bounds: [w, north, e, south], heights } = grid;
  const samples = [];
  for (let i = 0; i < n - 1; i += stride) samples.push(i);
  samples.push(n - 1); // Keep the shore/tile boundary even for non-divisible strides.
  const m = samples.length,positions=new Float32Array(m*m*3),uv=new Float32Array(m*m*2),indices=new (m*m>65535?Uint32Array:Uint16Array)((m-1)*(m-1)*6);
  let vertex=0,face=0;
  for (const j of samples) for (const i of samples) {
    positions[vertex*3]=w+(e-w)*i/(n-1);positions[vertex*3+1]=heights[j*n+i];positions[vertex*3+2]=north+(south-north)*j/(n-1);
    uv[vertex*2]=i/(n-1);uv[vertex*2+1]=1-j/(n-1);vertex++;
  }
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
    const a = j * m + i;
    indices[face++]=a;indices[face++]=a+m;indices[face++]=a+1;indices[face++]=a+1;indices[face++]=a+m;indices[face++]=a+m+1;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geometry.setIndex(new T.BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  return geometry;
}

export function terrainLOD(bounds, position, quality = 'balanced') {
  // Distance to the tile edge keeps both sides of a nearby cliff fully detailed.
  const [w, n, e, s] = bounds, [x, z] = position;
  const distance = Math.hypot(Math.max(w - x, 0, x - e), Math.max(n - z, 0, z - s));
  const factor = quality === 'mobile' ? .7 : quality === 'high' ? 1.45 : 1;
  return distance < 650 * factor ? 1 : distance < 1500 * factor ? 2 : distance < 2700 * factor ? 4 : 8;
}

// Pixel-accurate replacement: centroid clipping left coarse triangles across
// detailed valleys. Discard only fragments actually covered by a loaded tile.
export function overviewMask(material) {
  const capacity = 128;
  const uniforms = { terrainCount: { value: 0 }, terrainBounds: { value: Array.from({ length: capacity }, () => new T.Vector4()) } };
  // Shared with the Babylon material plugin; CPU geometry builders still use T.
  material.userData ||= {};
  material.userData.terrainMask = uniforms;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec2 overviewPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\noverviewPosition = transformed.xz;');
    shader.fragmentShader = `varying vec2 overviewPosition;\nuniform int terrainCount;\nuniform vec4 terrainBounds[${capacity}];\n${shader.fragmentShader}`.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      for (int i = 0; i < ${capacity}; i++) {
        if (i >= terrainCount) break;
        vec4 b = terrainBounds[i];
        if (overviewPosition.x >= b.x && overviewPosition.x <= b.z && overviewPosition.y >= b.y && overviewPosition.y <= b.w) discard;
      }`);
  };
  material.customProgramCacheKey = () => 'gabian-overview-mask-v1';
  return bounds => {
    if (bounds.length > capacity) throw new Error('Trop de tuiles de relief actives.');
    uniforms.terrainCount.value = bounds.length;
    bounds.forEach((b, i) => uniforms.terrainBounds.value[i].set(...b));
  };
}
