// Geospatial helpers.

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

let _userPos = null;
let _watchId = null;
const _listeners = new Set();

export function getUserPos() { return _userPos; }

export function onUserPos(fn) {
  _listeners.add(fn);
  if (_userPos) fn(_userPos);
  return () => _listeners.delete(fn);
}

export function getOnce(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation nicht verfügbar'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        _userPos = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
        for (const fn of _listeners) fn(_userPos);
        resolve(_userPos);
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000, ...options },
    );
  });
}

export function startWatch() {
  if (_watchId != null || !('geolocation' in navigator)) return;
  _watchId = navigator.geolocation.watchPosition(
    (p) => {
      _userPos = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
      for (const fn of _listeners) fn(_userPos);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 60000 },
  );
}

export function stopWatch() {
  if (_watchId != null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
}

export function formatDistance(km) {
  if (km == null || isNaN(km)) return '–';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
