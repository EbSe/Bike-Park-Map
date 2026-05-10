// Lightweight IndexedDB wrapper for the bikepark app.
// Stores: visits, media (blobs), customParks, settings, tracks (gpx).

const DB_NAME = 'bikeparks-v1';
const DB_VERSION = 2;

const STORES = {
  visits: 'visits',          // key: parkId; value: { parkId, rating, notes, sessions: [...], updatedAt }
  media: 'media',            // key: id; value: { id, parkId, sessionId?, type, blob, createdAt }
  customParks: 'customParks',// key: id; value: full park object with isCustom: true
  bucket: 'bucket',          // key: parkId; value: { parkId, addedAt }
  tracks: 'tracks',          // key: id; value: { id, parkId?, sessionId?, name, points: [...], stats, source, createdAt }
  settings: 'settings',      // key: name; value: any
};

let _dbPromise = null;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.visits)) {
        db.createObjectStore(STORES.visits, { keyPath: 'parkId' });
      }
      if (!db.objectStoreNames.contains(STORES.media)) {
        const s = db.createObjectStore(STORES.media, { keyPath: 'id' });
        s.createIndex('byPark', 'parkId');
      }
      if (!db.objectStoreNames.contains(STORES.customParks)) {
        db.createObjectStore(STORES.customParks, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.bucket)) {
        db.createObjectStore(STORES.bucket, { keyPath: 'parkId' });
      }
      if (!db.objectStoreNames.contains(STORES.tracks)) {
        const t = db.createObjectStore(STORES.tracks, { keyPath: 'id' });
        t.createIndex('byPark', 'parkId');
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  return _dbPromise;
}

function tx(store, mode = 'readonly') {
  return openDb().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Generic ops
export async function getAll(store) {
  return reqToPromise((await tx(store)).getAll());
}
export async function get(store, key) {
  return reqToPromise((await tx(store)).get(key));
}
export async function put(store, value) {
  return reqToPromise((await tx(store, 'readwrite')).put(value));
}
export async function del(store, key) {
  return reqToPromise((await tx(store, 'readwrite')).delete(key));
}
export async function clear(store) {
  return reqToPromise((await tx(store, 'readwrite')).clear());
}

// --- Visits ---
export async function getVisits() {
  return (await getAll(STORES.visits)) || [];
}
export async function getVisit(parkId) {
  return await get(STORES.visits, parkId);
}
export async function saveVisit(visit) {
  visit.updatedAt = Date.now();
  return await put(STORES.visits, visit);
}
export async function deleteVisit(parkId) {
  return await del(STORES.visits, parkId);
}
export async function setRating(parkId, rating) {
  const v = (await getVisit(parkId)) || { parkId, sessions: [] };
  v.rating = rating;
  await saveVisit(v);
  return v;
}
export async function setNotes(parkId, notes) {
  const v = (await getVisit(parkId)) || { parkId, sessions: [] };
  v.notes = notes;
  await saveVisit(v);
  return v;
}
export async function addSession(parkId, session) {
  const v = (await getVisit(parkId)) || { parkId, sessions: [] };
  v.sessions = v.sessions || [];
  if (!session.id) session.id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  if (!session.date) session.date = new Date().toISOString().slice(0, 10);
  v.sessions.unshift(session);
  await saveVisit(v);
  return session;
}
export async function deleteSession(parkId, sessionId) {
  const v = await getVisit(parkId);
  if (!v) return;
  v.sessions = (v.sessions || []).filter((s) => s.id !== sessionId);
  await saveVisit(v);
}

// --- Media ---
export async function addMedia({ parkId, sessionId = null, type, blob }) {
  const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item = { id, parkId, sessionId, type, blob, createdAt: Date.now() };
  await put(STORES.media, item);
  return item;
}
export async function getMediaByPark(parkId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out = [];
    const idx = db.transaction(STORES.media).objectStore(STORES.media).index('byPark');
    const req = idx.openCursor(IDBKeyRange.only(parkId));
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out.push(c.value); c.continue(); } else { resolve(out); }
    };
    req.onerror = () => reject(req.error);
  });
}
export async function getAllMedia() {
  return (await getAll(STORES.media)) || [];
}
export async function deleteMedia(id) {
  return await del(STORES.media, id);
}

// --- Custom parks ---
export async function getCustomParks() {
  return (await getAll(STORES.customParks)) || [];
}
export async function saveCustomPark(park) {
  if (!park.id) park.id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  park.isCustom = true;
  if (!park.country) park.country = 'OTHER';
  return await put(STORES.customParks, park);
}
export async function deleteCustomPark(id) {
  return await del(STORES.customParks, id);
}

// --- Bucket list ---
export async function getBucket() {
  return (await getAll(STORES.bucket)) || [];
}
export async function isInBucket(parkId) {
  const e = await get(STORES.bucket, parkId);
  return !!e;
}
export async function addToBucket(parkId) {
  return await put(STORES.bucket, { parkId, addedAt: Date.now() });
}
export async function removeFromBucket(parkId) {
  return await del(STORES.bucket, parkId);
}

// --- Tracks ---
export async function addTrack(track) {
  if (!track.id) track.id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  track.createdAt = track.createdAt || Date.now();
  await put(STORES.tracks, track);
  return track;
}
export async function getTracksByPark(parkId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out = [];
    const idx = db.transaction(STORES.tracks).objectStore(STORES.tracks).index('byPark');
    const req = idx.openCursor(IDBKeyRange.only(parkId));
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out.push(c.value); c.continue(); } else { resolve(out); }
    };
    req.onerror = () => reject(req.error);
  });
}
export async function getAllTracks() {
  return (await getAll(STORES.tracks)) || [];
}
export async function deleteTrack(id) {
  return await del(STORES.tracks, id);
}

// --- Settings ---
export async function getSetting(name, fallback = null) {
  const v = await get(STORES.settings, name);
  return v ? v.value : fallback;
}
export async function setSetting(name, value) {
  return await put(STORES.settings, { name, value });
}

// --- Backup / Restore ---
export async function exportAll() {
  const [visits, customParks, bucket, tracks, mediaItems] = await Promise.all([
    getVisits(), getCustomParks(), getBucket(), getAllTracks(), getAllMedia(),
  ]);
  // Convert blobs to base64 for portable JSON
  const media = await Promise.all(mediaItems.map(async (m) => ({
    ...m,
    blob: undefined,
    base64: await blobToBase64(m.blob),
    mime: m.blob.type,
  })));
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    visits, customParks, bucket, tracks, media,
  };
}

export async function importAll(data, { merge = true } = {}) {
  if (!merge) {
    await clear(STORES.visits);
    await clear(STORES.customParks);
    await clear(STORES.bucket);
    await clear(STORES.tracks);
    await clear(STORES.media);
  }
  for (const v of data.visits || []) await put(STORES.visits, v);
  for (const p of data.customParks || []) await put(STORES.customParks, p);
  for (const b of data.bucket || []) await put(STORES.bucket, b);
  for (const t of data.tracks || []) await put(STORES.tracks, t);
  for (const m of data.media || []) {
    const blob = await base64ToBlob(m.base64, m.mime);
    await put(STORES.media, { ...m, base64: undefined, mime: undefined, blob });
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function base64ToBlob(b64, mime) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export { STORES };
