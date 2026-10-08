export const ORIGIN = [5.36978, 43.29648];
export const TILE_ZOOM = 15;
const R = 6378137;
const SCALE = Math.cos(ORIGIN[1] * Math.PI / 180);
const mx0 = R * ORIGIN[0] * Math.PI / 180;
const my0 = R * Math.log(Math.tan(Math.PI / 4 + ORIGIN[1] * Math.PI / 360));
export function toLocal(lon, lat) {
  return [(R * lon * Math.PI / 180 - mx0) * SCALE, -(R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) - my0) * SCALE];
}
export function toGeo(x, z) {
  return [(x / SCALE + mx0) / R * 180 / Math.PI, (2 * Math.atan(Math.exp((-z / SCALE + my0) / R)) - Math.PI / 2) * 180 / Math.PI];
}
export function tileAt(lon, lat, zoom = TILE_ZOOM) {
  const n = 2 ** zoom;
  return [Math.floor((lon + 180) / 360 * n), Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)];
}
export function tileBounds(x, y, zoom = TILE_ZOOM) {
  const n = 2 ** zoom;
  const lat = row => Math.atan(Math.sinh(Math.PI * (1 - 2 * row / n))) * 180 / Math.PI;
  return [x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)];
}
export function localBounds(bounds) {
  const nw = toLocal(bounds[0], bounds[3]);
  const se = toLocal(bounds[2], bounds[1]);
  return [nw[0], nw[1], se[0], se[1]];
}
export function inRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function inPolygons(x, z, polygons) {
  return polygons.some(rings => inRing(x, z, rings[0]) && !rings.slice(1).some(ring => inRing(x, z, ring)));
}
export function sampleGrid(grid, x, z) {
  const [west, north, east, south] = grid.bounds;
  const u = Math.max(0, Math.min(grid.size - 1, (x - west) / (east - west) * (grid.size - 1)));
  const v = Math.max(0, Math.min(grid.size - 1, (z - north) / (south - north) * (grid.size - 1)));
  const i = Math.min(grid.size - 2, Math.floor(u)), j = Math.min(grid.size - 2, Math.floor(v));
  const a = u - i, b = v - j, h = grid.heights;
  return (h[j * grid.size + i] * (1 - a) + h[j * grid.size + i + 1] * a) * (1 - b) + (h[(j + 1) * grid.size + i] * (1 - a) + h[(j + 1) * grid.size + i + 1] * a) * b;
}
