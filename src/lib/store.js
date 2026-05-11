// Tiny event store + filter/derived state for the app.

import bundledData from '../data/bikeparks.json';
import * as db from './db.js';
import { haversineKm, getUserPos } from './geo.js';

// Bundled data is the curated set frozen at build time (fallback).
// Live data lives at <base>/data/bikeparks.json and is auto-refreshed weekly
// via the refresh-data GitHub Action.
const BASE_URL = import.meta.env.BASE_URL || '/';
const DATA_URL = `${BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/'}data/bikeparks.json`;

export const COUNTRY_NAMES = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', IT: 'Italien', OTHER: 'Sonstige' };
export const COUNTRY_FLAGS = { DE: '🇩🇪', AT: '🇦🇹', CH: '🇨🇭', IT: '🇮🇹', OTHER: '🚩' };
export const DIFFICULTY_LABELS = { green: 'leicht', blue: 'mittel', red: 'schwer', black: 'sehr schwer', double_black: 'extrem' };
export const BIKE_TYPE_LABELS = {
  downhill: 'Downhill', enduro: 'Enduro', freeride: 'Freeride', allmountain: 'All Mountain',
  xc: 'XC / Cross-Country', flow: 'Flow', kids: 'Kids', ebike: 'E-MTB', dirt: 'Dirt',
  pumptrack: 'Pumptrack', skill: 'Skill', fourx: '4X',
};
export const LIFT_LABELS = {
  gondola: 'Gondelbahn', chairlift: 'Sessellift', tbar: 'Schlepplift',
  funicular: 'Standseilbahn', cablecar: 'Seilbahn', shuttle: 'Shuttle',
  coaster: 'Sommerrodel', none: 'Kein Lift',
};
export const AMENITY_LABELS = {
  rental: 'Verleih', shop: 'Bikeshop', bikewash: 'Bikewash', food: 'Gastronomie',
  parking: 'Parkplatz', shuttle: 'Shuttle', lessons: 'Bikeschule',
  kidspark: 'Kids-Bereich', skillarea: 'Skill-Area', camping: 'Camping',
  eMTBcharge: 'E-MTB-Ladestation',
};
export const AMENITY_ICONS = {
  rental: '🚲', shop: '🛒', bikewash: '💦', food: '🍔', parking: '🅿️',
  shuttle: '🚐', lessons: '🎓', kidspark: '🧒', skillarea: '🛹',
  camping: '⛺', eMTBcharge: '🔌',
};

const _state = {
  parks: [],         // merged static + custom
  visits: new Map(), // parkId -> visit
  bucket: new Set(), // parkId set
  tracks: new Map(), // parkId -> [tracks]
  filters: defaultFilters(),
  search: '',
  sort: 'distance',  // distance | rating | name | difficulty
  view: 'map',       // map | list | stats | bucket | settings | detail
  detailParkId: null,
  ready: false,
  dataVersion: null,    // ISO timestamp of loaded data
  dataSource: 'bundled', // bundled | live | cached
};

function defaultFilters() {
  return {
    countries: new Set(['DE', 'AT', 'CH', 'IT']),
    difficulties: new Set(),    // empty = no filter
    bikeTypes: new Set(),
    lifts: new Set(),
    amenities: new Set(),
    maxPrice: null,             // €
    maxDistance: null,          // km
    onlyBucket: false,
    onlyVisited: false,
    onlyOpen: false,            // open today
    minRating: 0,
  };
}

const _listeners = new Set();
export function onChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }
function emit() { for (const fn of _listeners) fn(_state); }

export function getState() { return _state; }
export function getView() { return _state.view; }
export function setView(view, detailParkId = null) {
  _state.view = view;
  if (detailParkId) _state.detailParkId = detailParkId;
  emit();
}

export function setSearch(s) { _state.search = s; emit(); }
export function setSort(s) { _state.sort = s; emit(); }

export function setFilter(key, value) {
  _state.filters[key] = value;
  emit();
}
export function toggleSetMember(key, value) {
  const set = _state.filters[key];
  if (!(set instanceof Set)) return;
  if (set.has(value)) set.delete(value); else set.add(value);
  emit();
}
export function clearFilters() { _state.filters = defaultFilters(); emit(); }

export function activeFilterCount() {
  const f = _state.filters;
  let n = 0;
  if (f.countries.size !== 4) n++;
  if (f.difficulties.size > 0) n++;
  if (f.bikeTypes.size > 0) n++;
  if (f.lifts.size > 0) n++;
  if (f.amenities.size > 0) n++;
  if (f.maxPrice != null) n++;
  if (f.maxDistance != null) n++;
  if (f.onlyBucket) n++;
  if (f.onlyVisited) n++;
  if (f.onlyOpen) n++;
  if (f.minRating > 0) n++;
  return n;
}

function normalizeData(data) {
  if (Array.isArray(data)) return { parks: data, dataVersion: null };
  if (data && Array.isArray(data.parks)) return data;
  throw new Error('Unbekanntes Datenformat');
}

async function loadParks({ force = false } = {}) {
  const bundled = normalizeData(bundledData);
  // Cache-bust each load with a query param so HTTP caches at any layer
  // can't serve a stale copy. The SW NetworkFirst rule still gives us
  // an offline fallback through its own cache.
  const url = `${DATA_URL}?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: force ? 'reload' : 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const live = normalizeData(await res.json());
    if (Array.isArray(live.parks) && live.parks.length > 0) {
      _state.dataVersion = live.dataVersion || null;
      _state.dataSource = 'live';
      return live.parks;
    }
  } catch (err) {
    console.warn('Live data fetch failed, using bundled:', err.message);
  }
  _state.dataVersion = bundled.dataVersion || null;
  _state.dataSource = 'bundled';
  return bundled.parks;
}

export async function init() {
  const [parks, customParks] = await Promise.all([
    loadParks(),
    db.getCustomParks(),
  ]);
  _state.parks = [...parks, ...customParks];
  await refreshUserData();
  _state.ready = true;
  emit();
}

export async function refreshLiveData() {
  const parks = await loadParks({ force: true });
  const customParks = await db.getCustomParks();
  _state.parks = [...parks, ...customParks];
  emit();
  return { count: parks.length, version: _state.dataVersion, source: _state.dataSource };
}

export function getDataMeta() {
  return { version: _state.dataVersion, source: _state.dataSource };
}

export async function refreshUserData() {
  const [visits, bucket, tracks] = await Promise.all([
    db.getVisits(), db.getBucket(), db.getAllTracks(),
  ]);
  _state.visits = new Map(visits.map((v) => [v.parkId, v]));
  _state.bucket = new Set(bucket.map((b) => b.parkId));
  _state.tracks.clear();
  for (const t of tracks) {
    if (!t.parkId) continue;
    if (!_state.tracks.has(t.parkId)) _state.tracks.set(t.parkId, []);
    _state.tracks.get(t.parkId).push(t);
  }
  emit();
}

export function getPark(id) {
  return _state.parks.find((p) => p.id === id) || null;
}

export function getVisit(parkId) { return _state.visits.get(parkId); }
export function isInBucket(parkId) { return _state.bucket.has(parkId); }
export function getTracksForPark(parkId) { return _state.tracks.get(parkId) || []; }

export function isParkOpenToday(park) {
  if (!park.season || !park.season.from || !park.season.to) return null; // unknown
  const today = new Date();
  const yyyy = today.getFullYear();
  const monthDay = (s) => {
    const m = parseInt(s.slice(0, 2), 10);
    const d = parseInt(s.slice(3, 5), 10);
    return new Date(yyyy, m - 1, d);
  };
  let from = monthDay(park.season.from);
  let to = monthDay(park.season.to);
  if (to < from) to.setFullYear(yyyy + 1);
  return today >= from && today <= to;
}

export function applyFilters(parks = _state.parks) {
  const f = _state.filters;
  const search = _state.search.trim().toLowerCase();
  const userPos = getUserPos();
  const countriesActive = f.countries.size > 0;
  return parks.filter((p) => {
    if (countriesActive && !f.countries.has(p.country)) return false;
    if (search) {
      const hay = `${p.name} ${p.region || ''} ${p.country} ${(p.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (f.difficulties.size > 0) {
      const overlap = (p.difficulties || []).some((d) => f.difficulties.has(d));
      if (!overlap) return false;
    }
    if (f.bikeTypes.size > 0) {
      const overlap = (p.bikeTypes || []).some((t) => f.bikeTypes.has(t));
      if (!overlap) return false;
    }
    if (f.lifts.size > 0) {
      const overlap = (p.lift || []).some((l) => f.lifts.has(l));
      if (!overlap) return false;
    }
    if (f.amenities.size > 0) {
      const overlap = (p.amenities || []).some((a) => f.amenities.has(a));
      if (!overlap) return false;
    }
    if (f.maxPrice != null && p.prices?.dayPass != null && p.prices.dayPass > f.maxPrice) return false;
    if (f.maxDistance != null && userPos) {
      const d = haversineKm(userPos, { lat: p.lat, lon: p.lon });
      if (d > f.maxDistance) return false;
    }
    if (f.onlyBucket && !_state.bucket.has(p.id)) return false;
    if (f.onlyVisited && !_state.visits.has(p.id)) return false;
    if (f.onlyOpen) {
      const open = isParkOpenToday(p);
      if (open === false) return false;
    }
    if (f.minRating > 0) {
      const v = _state.visits.get(p.id);
      if (!v || !v.rating || v.rating < f.minRating) return false;
    }
    return true;
  });
}

export function sortParks(parks) {
  const userPos = getUserPos();
  const arr = [...parks];
  const sort = _state.sort;
  if (sort === 'distance' && userPos) {
    arr.sort((a, b) => haversineKm(userPos, a) - haversineKm(userPos, b));
  } else if (sort === 'rating') {
    arr.sort((a, b) => {
      const ra = _state.visits.get(a.id)?.rating || 0;
      const rb = _state.visits.get(b.id)?.rating || 0;
      return rb - ra;
    });
  } else if (sort === 'name') {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'difficulty') {
    const order = { green: 0, blue: 1, red: 2, black: 3, double_black: 4 };
    const maxDiff = (p) => Math.max(...(p.difficulties || ['blue']).map((d) => order[d] ?? 1));
    arr.sort((a, b) => maxDiff(b) - maxDiff(a));
  } else if (sort === 'price') {
    arr.sort((a, b) => (a.prices?.dayPass ?? 9999) - (b.prices?.dayPass ?? 9999));
  } else if (sort === 'visited') {
    arr.sort((a, b) => {
      const av = _state.visits.get(a.id)?.updatedAt || 0;
      const bv = _state.visits.get(b.id)?.updatedAt || 0;
      return bv - av;
    });
  }
  return arr;
}

// Helpers for views
export function listFilteredSorted() {
  return sortParks(applyFilters());
}

export function distanceTo(park) {
  const u = getUserPos();
  if (!u || park.lat == null || park.lon == null) return null;
  return haversineKm(u, { lat: park.lat, lon: park.lon });
}

// Aggregated stats from visits
export function aggregateStats() {
  const visits = [..._state.visits.values()];
  let parksVisited = 0;
  let totalSessions = 0;
  let totalKm = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let totalTime = 0;
  const countriesVisited = new Set();
  const tagsCount = {};
  const allRatings = [];

  for (const v of visits) {
    const sessions = v.sessions || [];
    if (sessions.length > 0) {
      parksVisited++;
      totalSessions += sessions.length;
      const park = getPark(v.parkId);
      if (park) {
        countriesVisited.add(park.country);
        for (const t of park.tags || []) tagsCount[t] = (tagsCount[t] || 0) + 1;
      }
      for (const s of sessions) {
        if (s.stats) {
          totalKm += (s.stats.distance_m || 0) / 1000;
          totalAscent += s.stats.ascent_m || 0;
          totalDescent += s.stats.descent_m || 0;
          totalTime += s.stats.movingTime_s || 0;
        }
      }
    }
    if (v.rating) allRatings.push(v.rating);
  }

  // Tracks not tied to a session
  const allTracks = [];
  for (const ts of _state.tracks.values()) for (const t of ts) allTracks.push(t);
  for (const t of allTracks) {
    if (t.attachedToSession) continue; // already counted via session
    if (!t.stats) continue;
    totalKm += (t.stats.distance_m || 0) / 1000;
    totalAscent += t.stats.ascent_m || 0;
    totalDescent += t.stats.descent_m || 0;
    totalTime += t.stats.movingTime_s || 0;
  }

  // Per-country breakdown of visited parks
  const byCountry = { DE: 0, AT: 0, CH: 0, IT: 0, OTHER: 0 };
  for (const v of visits) {
    if ((v.sessions || []).length === 0) continue;
    const p = getPark(v.parkId);
    if (!p) continue;
    const c = p.country || 'OTHER';
    byCountry[c] = (byCountry[c] || 0) + 1;
  }

  return {
    parksTotal: _state.parks.length,
    parksVisited,
    totalSessions,
    totalKm: Math.round(totalKm),
    totalAscent: Math.round(totalAscent),
    totalDescent: Math.round(totalDescent),
    totalTimeHours: Math.round((totalTime / 3600) * 10) / 10,
    countriesVisited: countriesVisited.size,
    avgRating: allRatings.length ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10 : 0,
    bucketCount: _state.bucket.size,
    byCountry,
    tagsCount,
  };
}

export function difficultyOrder(d) {
  return ({ green: 0, blue: 1, red: 2, black: 3, double_black: 4 })[d] ?? 5;
}
