// Compute OSM tile URL for a lat/lon at a given zoom.
// Returns a single static tile centered on the park (good enough for thumbnails).

export function tileForLatLon(lat, lon, zoom = 13) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

// Build a URL to a single OSM tile. Carto Voyager looks more modern than
// standard OSM raster style and is allowed for client-side use.
export function tileUrl(lat, lon, zoom = 13, style = 'voyager') {
  const { x, y, z } = tileForLatLon(lat, lon, zoom);
  if (style === 'topo') {
    return `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`;
  }
  if (style === 'dark') {
    return `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`;
  }
  // Voyager (light, with terrain shading) – clean and modern
  return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
}

// 4-tile mosaic for hero/banner. Returns array of 4 tile URLs (2x2 grid).
export function mosaicUrls(lat, lon, zoom = 12, style = 'dark') {
  const n = Math.pow(2, zoom);
  const xFloat = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const cx = Math.floor(xFloat);
  const cy = Math.floor(yFloat);
  const tiles = [];
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const x = cx + dx - (xFloat - cx > 0.5 ? 0 : 1);
      const y = cy + dy - (yFloat - cy > 0.5 ? 0 : 1);
      tiles.push(tileUrlAt(x, y, zoom, style));
    }
  }
  return tiles;
}

function tileUrlAt(x, y, z, style) {
  if (style === 'topo') return `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`;
  if (style === 'dark') return `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`;
  return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
}
