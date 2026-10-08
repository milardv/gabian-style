import { buildGeometry } from './buildings.js';
self.onmessage = event => {
  const { id, buildings, structures, terrain } = event.data;
  try {
    const data = buildGeometry(buildings, terrain, structures);
    self.postMessage({ id, data }, [data.sides.buffer, data.uvs.buffer, data.roofs.buffer, data.roofUvs.buffer, data.colors.buffer, data.domes.buffer, data.domeColors.buffer,data.towers.buffer,data.towerColors.buffer,data.statues.buffer,data.statueColors.buffer]);
  } catch (error) { self.postMessage({ id, error: error.message }); }
};
