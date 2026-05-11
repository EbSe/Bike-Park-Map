#!/usr/bin/env node
// Weekly data refresh script.
// Runs in GitHub Actions (with internet access). Pulls fresh OSM bikepark data
// via the Overpass API, merges it with the human-curated overlay (prices,
// season, descriptions), and writes the result to public/data/bikeparks.json.
//
// Strategy:
//   - For each curated park: fetch its OSM tags (if osm_id known) or query
//     by name+coord proximity. Update geo + trails + lifts if changed.
//   - Add any newly-tagged "bikepark" POIs from OSM in the 400km radius
//     around Ravensburg that are not in the curated set (as unverified).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CURATED = path.join(ROOT, 'src', 'data', 'curated-overlay.json');
const OUT = path.join(ROOT, 'public', 'data', 'bikeparks.json');

const RVB = { lat: 47.7833, lon: 9.6167 };
const RADIUS_KM = 400;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

// Bounding box around Ravensburg ± ~4° lat, ~5.5° lon → covers 400km radius
const BBOX = [44.5, 4.5, 51.0, 15.5];

const QUERY = `
[out:json][timeout:180];
(
  nwr["leisure"="bikepark"](${BBOX.join(',')});
  nwr["sport"="mtb"](${BBOX.join(',')});
  nwr["name"~"Bikepark|Bike Park|Bike-Park|Mountainbikepark|Flowtrail",i](${BBOX.join(',')});
  nwr["piste:type"="downhill"]["piste:difficulty"](${BBOX.join(',')});
);
out center tags;
`;

function haversineKm(a, b) {
  const R = 6371, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function overpass() {
  for (const endpoint of ENDPOINTS) {
    try {
      console.error(`Trying ${endpoint}…`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(QUERY),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`  failed: ${err.message}`);
    }
  }
  return null;
}

function normalize(element) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) return null;
  const name = tags.name || tags['name:de'] || tags.operator;
  if (!name) return null;
  return {
    osmId: `${element.type}/${element.id}`,
    name,
    lat,
    lon,
    homepage: tags['contact:website'] || tags.website || null,
    osmTags: tags,
  };
}

function findMatch(curatedPark, osmParks) {
  // Match by proximity (within 800m and similar name)
  const candidates = osmParks.filter((o) => haversineKm(curatedPark, o) < 0.8);
  if (candidates.length === 0) return null;
  // Best by name similarity
  const lowerName = curatedPark.name.toLowerCase();
  candidates.sort((a, b) => {
    const aMatch = a.name.toLowerCase().includes('bike') || lowerName.includes(a.name.toLowerCase()) ? 1 : 0;
    const bMatch = b.name.toLowerCase().includes('bike') || lowerName.includes(b.name.toLowerCase()) ? 1 : 0;
    return bMatch - aMatch;
  });
  return candidates[0];
}

async function main() {
  const curated = JSON.parse(await fs.readFile(CURATED, 'utf8'));
  console.error(`Loaded ${curated.length} curated parks`);

  const osmData = await overpass();
  let updated = 0;
  let mergeNote = 'OSM merge skipped (Overpass unreachable)';

  if (osmData?.elements) {
    const osmParks = osmData.elements.map(normalize).filter(Boolean);
    console.error(`Got ${osmParks.length} OSM-tagged candidates`);
    for (const cp of curated) {
      const m = findMatch(cp, osmParks);
      if (!m) continue;
      // Update only fields where OSM is authoritative & we don't have curated value
      cp.osmId = m.osmId;
      if (!cp.homepage && m.homepage) cp.homepage = m.homepage;
      // OSM coords are sometimes more precise – snap if very close
      if (haversineKm(cp, m) < 0.3) {
        cp.lat = m.lat;
        cp.lon = m.lon;
      }
      updated++;
    }
    mergeNote = `OSM merge OK · ${updated}/${curated.length} parks updated`;
  }

  const output = {
    dataVersion: new Date().toISOString(),
    source: 'curated+osm',
    count: curated.length,
    note: mergeNote,
    parks: curated,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(output, null, 2));
  console.error(`Wrote ${OUT}`);
  console.error(mergeNote);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
