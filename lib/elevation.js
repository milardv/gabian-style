import { toGeo } from '../public/flight/geo.js';

const ENDPOINT = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
// One shared queue for all visitors/tiles: IGN allows five requests/s per IP.
export function elevationClient({ fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
  let queue = Promise.resolve(), nextRequest = 0;
  return body => {
    const request = queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        await pause(Math.max(0, nextRequest - now()));
        nextRequest = now() + 300;
        const response = await fetcher(ENDPOINT, {
          method: 'POST', signal: AbortSignal.timeout(25000),
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'GabianStyle/1.0' },
          body: JSON.stringify(body)
        });
        if (response.ok) return response.json();
        if (attempt >= 3 || ![429, 502, 503, 504].includes(response.status)) throw new Error(`Altimétrie IGN indisponible (${response.status}).`);
        const retry = response.headers.get('Retry-After');
        const wait = retry && Number.isFinite(Number(retry)) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - now()) || 0;
        nextRequest = now() + Math.max(wait, 1000 * 2 ** attempt);
      }
    });
    queue = request.catch(() => {});
    return request;
  };
}
const requestElevation = elevationClient();
export async function elevationGrid(bounds, size, request = requestElevation) {
  const [west, north, east, south] = bounds, points = [], heights = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) points.push(toGeo(west + (east - west) * x / (size - 1), north + (south - north) * y / (size - 1)));
  // POST avoids URL size limits; 4000 points stays below IGN's 5000 limit.
  for (let start = 0; start < points.length; start += 4000) {
    const batch = points.slice(start, start + 4000);
    const data = await request({ resource: 'ign_rge_alti_wld', delimiter: '|', zonly: 'true', lon: batch.map(p => p[0].toFixed(7)).join('|'), lat: batch.map(p => p[1].toFixed(7)).join('|') });
    if (data.elevations?.length !== batch.length) throw new Error('Grille altimétrique IGN incomplète.');
    for (const height of data.elevations) {
      if (!Number.isFinite(height) || height < -99999) throw new Error('Altitude IGN invalide.');
      // Coastal samples can mix the -99999 no-data sentinel with valid raster
      // values (observed -74999.25, -24999.75, etc.). Marseille's sea is
      // rendered at zero, including these missing coastal elevations.
      heights.push(Math.max(0, height));
    }
  }
  return { bounds, size, heights, source: 'IGN RGE ALTI', no_data_height: 0 };
}
export function terrainSize(bounds) {
  // Calanques and their narrow islands need ~5.5 m samples instead of ~11 m.
  return bounds[1] < 43.245 && bounds[2] > 5.29 ? 161 : 81;
}
