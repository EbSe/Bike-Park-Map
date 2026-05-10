import L from 'leaflet';
import 'leaflet.markercluster';
import * as store from '../lib/store.js';
import * as geo from '../lib/geo.js';
import { formatDistance } from '../lib/geo.js';

let _map = null;
let _cluster = null;
let _markers = new Map();
let _userMarker = null;
let _layers = {};
let _activeLayer = 'osm';
let _contextCard = null;

const TILE_LAYERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
    label: '🗺️ Standard',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
    subdomains: 'abc',
    label: '⛰ Topo',
  },
  carto: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© CARTO © OSM',
    maxZoom: 19,
    subdomains: 'abcd',
    label: '🌙 Dunkel',
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
    center: [47.3, 11.0],
    zoom: 6,
    zoomControl: false,
    attributionControl: true,
    tap: false,
  });
  L.control.zoom({ position: 'bottomright' }).addTo(_map);

  _layers.osm = buildLayer('osm');
  _layers.topo = buildLayer('topo');
  _layers.carto = buildLayer('carto');
  _layers.osm.addTo(_map);
  _activeLayer = 'osm';

  _cluster = L.markerClusterGroup({
    maxClusterRadius: 55,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    chunkedLoading: true,
    iconCreateFunction: (cl) => {
      const n = cl.getChildCount();
      const size = Math.max(40, Math.min(60, 36 + n));
      return L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:${n < 10 ? 14 : 13}px">${n}</div>`,
        className: 'marker-cluster',
        iconSize: [size, size],
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
        icon: L.divIcon({ className: 'user-location-wrap', html: '<div class="user-location"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
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
    window.dispatchEvent(new CustomEvent('map-layer-changed', { detail: { layer: next, label: TILE_LAYERS[next].label } }));
  });

  // Tap on map closes context card
  _map.on('click', () => hideContextCard());

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
  if (visit && (visit.sessions || []).length > 0) { cls += ' visited'; emoji = '✓'; }
  else if (inBucket) { cls += ' bucket'; emoji = '★'; }
  if (park.isCustom) cls += ' custom';

  const icon = L.divIcon({
    className: 'leaflet-bp-marker',
    html: `<div class="${cls}"><span>${emoji}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
  const marker = L.marker([park.lat, park.lon], { icon, title: park.name });

  marker.on('click', () => {
    showContextCard(park);
  });

  return marker;
}

function showContextCard(park) {
  hideContextCard();
  const dist = store.distanceTo(park);
  const visit = store.getVisit(park.id);
  const sessions = visit?.sessions?.length || 0;
  const flag = store.COUNTRY_FLAGS[park.country] || '📍';

  _contextCard = document.createElement('div');
  _contextCard.className = 'map-context-card';
  _contextCard.innerHTML = `
    <div class="mcc-content">
      <h3>${flag} ${escapeHtml(park.name)}</h3>
      <div class="mcc-meta">
        <span>${escapeHtml(park.region || '')}</span>
        ${dist != null ? `<span>· ${formatDistance(dist)}</span>` : ''}
        ${park.elevation?.vertical ? `<span>· ${park.elevation.vertical} hm</span>` : ''}
        ${sessions > 0 ? `<span>· ✓ ${sessions}× gefahren</span>` : ''}
      </div>
    </div>
    <button class="mcc-cta">Details ›</button>
  `;
  document.getElementById('view-map').appendChild(_contextCard);
  // Trigger transition
  requestAnimationFrame(() => _contextCard.classList.add('open'));
  _contextCard.querySelector('.mcc-cta').addEventListener('click', (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('park:open', { detail: { parkId: park.id } }));
  });
  _contextCard.addEventListener('click', (e) => {
    if (e.target.closest('.mcc-cta')) return;
    window.dispatchEvent(new CustomEvent('park:open', { detail: { parkId: park.id } }));
  });
}

function hideContextCard() {
  if (!_contextCard) return;
  _contextCard.classList.remove('open');
  const el = _contextCard;
  _contextCard = null;
  setTimeout(() => el && el.remove(), 350);
}

export function focusPark(parkId) {
  const park = store.getPark(parkId);
  if (!park || !_map) return;
  _map.setView([park.lat, park.lon], Math.max(_map.getZoom(), 12), { animate: true, duration: 0.5 });
}

export function flyToUser() {
  if (!_map) return;
  const u = geo.getUserPos();
  if (u) _map.setView([u.lat, u.lon], 11, { animate: true });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
