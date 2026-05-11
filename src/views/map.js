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
let _activeLayer = 'dark';
let _contextCard = null;

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '© CARTO © OSM',
    maxZoom: 19,
    subdomains: 'abcd',
    label: 'Dunkel',
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '© CARTO © OSM',
    maxZoom: 19,
    subdomains: 'abcd',
    label: 'Hell',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
    subdomains: 'abc',
    label: 'Topo',
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

  _layers.dark = buildLayer('dark');
  _layers.voyager = buildLayer('voyager');
  _layers.topo = buildLayer('topo');
  _layers.dark.addTo(_map);
  _activeLayer = 'dark';

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
    const order = ['dark', 'voyager', 'topo'];
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

const MARKER_GLYPHS = {
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><polyline points="6 17 10 11 13 11 17 17"/><line x1="10" y1="11" x2="13" y2="6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 10 18 20 6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.5 7.1.8-5.3 4.9 1.5 7.1L12 18l-6.2 3.8 1.5-7.1L2 9.8l7.1-.8L12 2.5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>',
};

function createMarker(park) {
  const visit = store.getVisit(park.id);
  const inBucket = store.isInBucket(park.id);
  let cls = 'map-marker';
  let glyph = MARKER_GLYPHS.default;
  if (visit && (visit.sessions || []).length > 0) { cls += ' visited'; glyph = MARKER_GLYPHS.check; }
  else if (inBucket) { cls += ' bucket'; glyph = MARKER_GLYPHS.star; }
  if (park.isCustom) { cls += ' custom'; glyph = MARKER_GLYPHS.plus; }

  const icon = L.divIcon({
    className: 'leaflet-bp-marker',
    html: `<div class="${cls}"><span class="m-glyph">${glyph}</span></div>`,
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
