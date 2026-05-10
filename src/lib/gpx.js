// GPX & FIT parsers. Pure browser (no deps).

export function parseGPX(xmlString) {
  const dom = new DOMParser().parseFromString(xmlString, 'text/xml');
  if (dom.querySelector('parsererror')) {
    throw new Error('Ungültige GPX-Datei');
  }
  const trkpts = Array.from(dom.getElementsByTagName('trkpt'));
  const rtepts = trkpts.length ? trkpts : Array.from(dom.getElementsByTagName('rtept'));
  const wpts = rtepts.length ? rtepts : Array.from(dom.getElementsByTagName('wpt'));
  const points = wpts.map((p) => {
    const lat = parseFloat(p.getAttribute('lat'));
    const lon = parseFloat(p.getAttribute('lon'));
    const eleEl = p.getElementsByTagName('ele')[0];
    const timeEl = p.getElementsByTagName('time')[0];
    return {
      lat, lon,
      ele: eleEl ? parseFloat(eleEl.textContent) : null,
      time: timeEl ? new Date(timeEl.textContent).getTime() : null,
    };
  }).filter((p) => isFinite(p.lat) && isFinite(p.lon));

  const nameEl = dom.getElementsByTagName('name')[0];
  const name = nameEl ? nameEl.textContent : 'GPX-Track';
  return { name, points, source: 'gpx', stats: computeStats(points) };
}

export function computeStats(points) {
  let distance_m = 0;
  let ascent_m = 0;
  let descent_m = 0;
  let maxSpeed_ms = 0;
  let movingTime_ms = 0;
  let totalTime_ms = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segDist = haversine(a.lat, a.lon, b.lat, b.lon);
    distance_m += segDist;

    if (a.ele != null && b.ele != null) {
      const dEle = b.ele - a.ele;
      if (dEle > 0) ascent_m += dEle;
      else descent_m += -dEle;
      if (b.ele < minEle) minEle = b.ele;
      if (b.ele > maxEle) maxEle = b.ele;
    }

    if (a.time && b.time) {
      const dt = (b.time - a.time);
      totalTime_ms += dt;
      if (dt > 0 && dt < 30000 && segDist > 0) {
        movingTime_ms += dt;
        const v = (segDist / dt) * 1000; // m/s
        if (v > maxSpeed_ms) maxSpeed_ms = v;
      }
    }
  }

  return {
    distance_m: Math.round(distance_m),
    ascent_m: Math.round(ascent_m),
    descent_m: Math.round(descent_m),
    minEle: minEle === Infinity ? null : Math.round(minEle),
    maxEle: maxEle === -Infinity ? null : Math.round(maxEle),
    movingTime_s: Math.round(movingTime_ms / 1000),
    totalTime_s: Math.round(totalTime_ms / 1000),
    maxSpeed_kmh: Math.round((maxSpeed_ms * 3.6) * 10) / 10,
    avgSpeed_kmh: movingTime_ms > 0 ? Math.round((distance_m / (movingTime_ms / 1000)) * 3.6 * 10) / 10 : 0,
    pointCount: points.length,
  };
}

function haversine(la1, lo1, la2, lo2) {
  const R = 6371000;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const r1 = (la1 * Math.PI) / 180;
  const r2 = (la2 * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// --- FIT parser (subset: just position records + timestamps + altitude) ---
// FIT is a binary protocol. We implement a *subset* that reliably extracts
// {position_lat, position_long, altitude, timestamp, speed}.
// Reference: https://developer.garmin.com/fit/protocol/
const FIT_EPOCH = 631065600; // 1989-12-31T00:00:00Z

export function parseFIT(buffer) {
  const view = new DataView(buffer);
  const totalLen = view.byteLength;
  if (totalLen < 14) throw new Error('FIT-Datei zu kurz');

  // Header
  const headerSize = view.getUint8(0);
  const protoVer = view.getUint8(1);
  const dataSize = view.getUint32(4, true);
  const sig = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (sig !== '.FIT') throw new Error('Keine gültige FIT-Datei');

  let pos = headerSize;
  const dataEnd = headerSize + dataSize;

  const defs = {}; // local message type definitions

  const records = [];

  while (pos < dataEnd) {
    const recHeader = view.getUint8(pos++);
    const isCompressed = (recHeader & 0x80) !== 0;
    if (isCompressed) {
      const localType = (recHeader >> 5) & 0x03;
      const def = defs[localType];
      if (!def) break;
      const result = readRecord(view, pos, def);
      pos = result.pos;
      records.push({ localType, fields: result.fields });
    } else {
      const isDef = (recHeader & 0x40) !== 0;
      const localType = recHeader & 0x0F;
      if (isDef) {
        const result = readDefinition(view, pos);
        defs[localType] = result.def;
        pos = result.pos;
      } else {
        const def = defs[localType];
        if (!def) break;
        const result = readRecord(view, pos, def);
        pos = result.pos;
        records.push({ localType, fields: result.fields, msgNum: def.globalMsgNum });
      }
    }
  }

  // global_msg_num 20 = record (lat/lon/ele/timestamp)
  const points = [];
  for (const r of records) {
    if (r.msgNum !== 20) continue;
    const f = r.fields;
    const lat = f.position_lat != null ? semicirclesToDeg(f.position_lat) : null;
    const lon = f.position_long != null ? semicirclesToDeg(f.position_long) : null;
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) continue;
    points.push({
      lat, lon,
      ele: f.altitude != null ? f.altitude / 5 - 500 : (f.enhanced_altitude != null ? f.enhanced_altitude / 5 - 500 : null),
      time: f.timestamp != null ? (FIT_EPOCH + f.timestamp) * 1000 : null,
    });
  }

  return { name: 'FIT-Track', points, source: 'fit', stats: computeStats(points) };
}

function semicirclesToDeg(s) {
  return s * (180 / Math.pow(2, 31));
}

function readDefinition(view, pos) {
  pos++; // reserved
  const arch = view.getUint8(pos++);
  const little = arch === 0;
  const globalMsgNum = view.getUint16(pos, little); pos += 2;
  const numFields = view.getUint8(pos++);
  const fields = [];
  for (let i = 0; i < numFields; i++) {
    const fieldDefNum = view.getUint8(pos++);
    const size = view.getUint8(pos++);
    const baseType = view.getUint8(pos++);
    fields.push({ fieldDefNum, size, baseType });
  }
  return { pos, def: { little, globalMsgNum, fields, devFields: [] } };
}

function readRecord(view, pos, def) {
  const out = {};
  for (const f of def.fields) {
    const value = readFitValue(view, pos, f.size, f.baseType, def.little);
    pos += f.size;
    const name = FIT_FIELD_MAP[def.globalMsgNum]?.[f.fieldDefNum];
    if (name && value != null) out[name] = value;
  }
  // skip dev fields
  for (const f of def.devFields || []) pos += f.size;
  return { pos, fields: out };
}

function readFitValue(view, pos, size, baseType, little) {
  // Base types per FIT spec
  switch (baseType) {
    case 0x00: { const v = view.getUint8(pos); return v === 0xFF ? null : v; } // enum
    case 0x01: { const v = view.getInt8(pos); return v === 0x7F ? null : v; }
    case 0x02: { const v = view.getUint8(pos); return v === 0xFF ? null : v; }
    case 0x83: { const v = view.getInt16(pos, little); return v === 0x7FFF ? null : v; }
    case 0x84: { const v = view.getUint16(pos, little); return v === 0xFFFF ? null : v; }
    case 0x85: { const v = view.getInt32(pos, little); return v === 0x7FFFFFFF ? null : v; }
    case 0x86: { const v = view.getUint32(pos, little); return v === 0xFFFFFFFF ? null : v; }
    case 0x88: return view.getFloat32(pos, little);
    case 0x89: return view.getFloat64(pos, little);
    case 0x07: { // string
      let s = '';
      for (let i = 0; i < size; i++) {
        const c = view.getUint8(pos + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s || null;
    }
    case 0x0A: { const v = view.getUint8(pos); return v === 0x00 ? null : v; }
    case 0x8B: { const v = view.getUint16(pos, little); return v === 0x0000 ? null : v; }
    case 0x8C: { const v = view.getUint32(pos, little); return v === 0x00000000 ? null : v; }
    default: return null;
  }
}

// Field maps per global message number (subset).
const FIT_FIELD_MAP = {
  // record (msg 20)
  20: {
    253: 'timestamp',
    0: 'position_lat',
    1: 'position_long',
    2: 'altitude',
    3: 'heart_rate',
    4: 'cadence',
    5: 'distance',
    6: 'speed',
    7: 'power',
    13: 'temperature',
    78: 'enhanced_altitude',
    73: 'enhanced_speed',
  },
  // session (18)
  18: {
    253: 'timestamp',
    2: 'start_time',
    7: 'total_elapsed_time',
    8: 'total_timer_time',
    9: 'total_distance',
    14: 'avg_speed',
    15: 'max_speed',
    22: 'total_ascent',
    23: 'total_descent',
  },
};

export async function parseTrackFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'gpx' || file.type === 'application/gpx+xml') {
    const text = await file.text();
    const t = parseGPX(text);
    if (file.name) t.name = file.name.replace(/\.gpx$/i, '');
    return t;
  }
  if (ext === 'fit') {
    const buf = await file.arrayBuffer();
    const t = parseFIT(buf);
    if (file.name) t.name = file.name.replace(/\.fit$/i, '');
    return t;
  }
  throw new Error('Nur .gpx und .fit Dateien werden unterstützt');
}

export function trackToGPX(track) {
  const trkpts = track.points.map((p) => {
    const ele = p.ele != null ? `<ele>${p.ele}</ele>` : '';
    const time = p.time ? `<time>${new Date(p.time).toISOString()}</time>` : '';
    return `<trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}</trkpt>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bikepark Map" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(track.name || 'Track')}</name>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
