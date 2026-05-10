#!/usr/bin/env node
// Fetch bikepark POIs from OpenStreetMap Overpass API.
// Region: Süddeutschland (BY, BW), Österreich, Schweiz, Norditalien (down to ~lat 45.4 Garda area).
// We use a generous bounding box and combine multiple tag queries.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'data', 'osm-bikeparks.json');

// south, west, north, east
const BBOX = [44.8, 5.6, 50.7, 17.2];

// Overpass QL: nodes/ways/relations matching bikepark-ish tags.
const QUERY = `
[out:json][timeout:180];
(
  nwr["sport"="cycling"]["bicycle"!="no"](${BBOX.join(',')});
  nwr["leisure"="bikepark"](${BBOX.join(',')});
  nwr["leisure"="sports_centre"]["sport"~"cycling|mtb"](${BBOX.join(',')});
  nwr["sport"="mtb"](${BBOX.join(',')});
  nwr["highway"="cycleway"]["mtb:scale"](${BBOX.join(',')});
  nwr["route"="mtb"](${BBOX.join(',')});
  nwr["piste:type"="downhill"]["piste:difficulty"](${BBOX.join(',')});
  nwr["name"~"Bikepark|Bike Park|Bike-Park|Mountainbikepark",i](${BBOX.join(',')});
  nwr["name"~"Flowtrail|Flow Trail|Singletrail Park",i](${BBOX.join(',')});
);
out center tags;
`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

async function fetchWithFallback() {
  let lastErr;
  for (const endpoint of ENDPOINTS) {
    try {
      process.stderr.write(`Trying ${endpoint}…\n`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(QUERY),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      process.stderr.write(`  failed: ${err.message}\n`);
    }
  }
  throw lastErr;
}

function classify(tags) {
  const name = (tags.name || '').toLowerCase();
  if (tags['leisure'] === 'bikepark') return 'bikepark';
  if (/bikepark|bike-park|bike park|mountainbike\s*park|mtb\s*park/i.test(name)) return 'bikepark';
  if (/flowtrail|flow trail|singletrail park/i.test(name)) return 'flowtrail';
  if (tags['piste:type'] === 'downhill') return 'downhill';
  if (tags['route'] === 'mtb' || tags['sport'] === 'mtb') return 'mtb_route';
  return 'cycling_other';
}

function pickHomepage(tags) {
  return tags['contact:website'] || tags.website || tags['website:de'] || tags['url'] || null;
}

function pickName(tags) {
  return tags.name || tags['name:de'] || tags['name:en'] || tags.operator || null;
}

function countryFromLatLon(lat, lon) {
  // Rough heuristic from bbox. Refined by reverse-geocoded data later if needed.
  // CH: roughly 45.8–47.8 N, 5.9–10.5 E
  // AT: 46.4–49.0 N, 9.5–17.2 E
  // IT north: 44.8–47.0 N, 6.6–13.9 E (north of ~46 is Trentino-ST + Veneto)
  // DE south: 47.3–50.6 N, 6.0–13.9 E
  if (lat >= 45.8 && lat <= 47.9 && lon >= 5.9 && lon <= 10.5) return 'CH';
  if (lat >= 46.4 && lat <= 49.1 && lon >= 9.4 && lon <= 17.2) return 'AT';
  if (lat < 47.05 && lon >= 6.6 && lon <= 13.9) return 'IT';
  if (lat >= 47.0 && lon >= 5.8 && lon <= 14.0) return 'DE';
  // Fallback by lat
  if (lat >= 47.3) return 'DE';
  return 'AT';
}

function normalize(element) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) return null;
  const name = pickName(tags);
  if (!name) return null;
  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    lat,
    lon,
    type: classify(tags),
    country: countryFromLatLon(lat, lon),
    homepage: pickHomepage(tags),
    operator: tags.operator || null,
    description: tags.description || null,
    osm: {
      type: element.type,
      id: element.id,
      tags,
    },
  };
}

function dedupe(items) {
  // Drop items whose name+coords are very close (50m).
  const out = [];
  for (const it of items) {
    const dup = out.find(
      (o) =>
        o.name.toLowerCase() === it.name.toLowerCase() &&
        Math.abs(o.lat - it.lat) < 0.0006 &&
        Math.abs(o.lon - it.lon) < 0.0006,
    );
    if (!dup) out.push(it);
  }
  return out;
}

async function main() {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const data = await fetchWithFallback();
  const all = (data.elements || []).map(normalize).filter(Boolean);
  const bikepark = all.filter((i) => i.type === 'bikepark' || i.type === 'flowtrail' || i.type === 'downhill');
  const deduped = dedupe(bikepark);
  process.stderr.write(`Total elements: ${data.elements?.length || 0}, normalized: ${all.length}, bikepark-relevant: ${bikepark.length}, after dedupe: ${deduped.length}\n`);
  await fs.writeFile(OUT, JSON.stringify(deduped, null, 2));
  process.stderr.write(`Wrote ${OUT}\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
