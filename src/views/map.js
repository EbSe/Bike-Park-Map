import L from 'leaflet';
import 'leaflet.markercluster';
import * as store from '../lib/store.js';
import * as geo from '../lib/geo.js';

let _map = null;
let _cluster = null;
let _markers = new Map(); // parkId -> marker
let _userMarker = null;
let _layers = {};
let _activeLayer = 'osm';

const TILE_LAYERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
    subdomains: 'abc',
  },
  carto: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© CARTO © OSM',
    maxZoom: 19,
    subdomains: 'abcd',
  },
};

function buildLayer(key) {
  const cfg = TILE_LAYERS[key];
  return L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    maxZoom: cfg.maxZoom,
    subdomains: cfg.subdomains || 'abc',
  });
}

export function renderMap(container) {
  if (_map) return _map;
  _map = L.map(container, {
    center: [47.3, 11.5],
    zoom: 6,
    zoomControl: true,
    attributionControl: true,
    tap: false, // iOS double-tap fix
  });

  _layers.osm = buildLayer('osm');
  _layers.topo = buildLayer('topo');
  _layers.carto = buildLayer('carto');
  _layers.osm.addTo(_map);
  _activeLayer = 'osm';

  _cluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    chunkedLoading: true,
    iconCreateFunction: (cl) => {
      const n = cl.getChildCount();
      const cls = n < 10 ? 'sm' : n < 30 ? 'md' : 'lg';
      return L.divIcon({
        html: `<div class="marker-cluster-${cls}"><span>${n}</span></div>`,
        className: `marker-cluster marker-cluster-${cls}`,
        iconSize: [40, 40],
      });
    },
  });
  _map.addLayer(_cluster);

  refreshMarkers();

  geo.onUserPos((pos) => {
    if (_userMarker) {
      _userMarker.setLatLng([pos.lat, pos.lon]);
    } else {
      _userMarker = L.marker([pos.lat, pos.lon], {
        icon: L.divIcon({ className: 'user-location-wrap', html: '<div class="user-location"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
        interactive: false,
        keyboard: false,
      }).addTo(_map);
    }
  });

  window.addEventListener('toggle-map-layer', () => {
    const order = ['osm', 'topo', 'carto'];
    const idx = order.indexOf(_activeLayer);
    const next = order[(idx + 1) % order.length];
    _map.removeLayer(_layers[_activeLayer]);
    _map.addLayer(_layers[next]);
    _activeLayer = next;
  });

  // Resize handling
  setTimeout(() => _map.invalidateSize(), 250);
  window.addEventListener('resize', () => _map && _map.invalidateSize());

  return _map;
}

export function refreshMarkers() {
  if (!_cluster) return;
  _cluster.clearLayers();
  _markers.clear();
  const parks = store.applyFilters();
  for (const p of parks) {
    const m = createMarker(p);
    _markers.set(p.id, m);
    _cluster.addLayer(m);
  }
}

function createMarker(park) {
  const visit = store.getVisit(park.id);
  const inBucket = store.isInBucket(park.id);
  let cls = 'map-marker';
  let emoji = '🚵';
  if (visit && (visit.sessions || []).length > 0) { cls += ' visited'; emoji = '✅'; }
  else if (inBucket) { cls += ' bucket'; emoji = '⭐'; }
  if (park.isCustom) cls += ' custom';

  const icon = L.divIcon({
    className: 'leaflet-bp-marker',
    html: `<div class="${cls}">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
  const marker = L.marker([park.lat, park.lon], { icon, title: park.name });

  const popupContent = document.createElement('div');
  popupContent.innerHTML = `
    <p class="popup-name flag-${(park.country || 'other').toLowerCase()}">${park.name}</p>
    <p class="popup-meta">${park.region || ''}</p>
    <p class="popup-meta">${(park.bikeTypes || []).slice(0, 3).map((t) => store.BIKE_TYPE_LABELS[t] || t).join(' · ')}</p>
    <a href="#" class="popup-cta" data-park="${park.id}">Details ›</a>
  `;
  popupContent.querySelector('a').addEventListener('click', (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('park:open', { detail: { parkId: park.id } }));
  });
  marker.bindPopup(popupContent);
  return marker;
}

export function focusPark(parkId) {
  const park = store.getPark(parkId);
  if (!park || !_map) return;
  _map.setView([park.lat, park.lon], Math.max(_map.getZoom(), 12), { animate: true });
}

export function flyToUser() {
  if (!_map) return;
  const u = geo.getUserPos();
  if (u) _map.setView([u.lat, u.lon], 11, { animate: true });
}
