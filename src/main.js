import './styles/main.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

import * as store from './lib/store.js';
import * as geo from './lib/geo.js';
import { renderMap, focusPark, refreshMarkers } from './views/map.js';
import { renderList } from './views/list.js';
import { renderDetail } from './views/detail.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';
import { renderFilterSheet } from './views/filter.js';
import { showToast } from './views/toast.js';
import { handleShareTarget } from './views/share-target.js';

const TABS = [
  { id: 'map', label: 'Karte', icon: '🗺️' },
  { id: 'list', label: 'Liste', icon: '📋' },
  { id: 'bucket', label: 'Wishlist', icon: '⭐' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'settings', label: 'Mehr', icon: '⚙️' },
];

const root = document.getElementById('app');

function buildShell() {
  root.innerHTML = `
    <div class="topbar">
      <h1 id="topbar-title">Bikepark Map</h1>
      <div class="topbar-actions" id="topbar-actions"></div>
    </div>
    <div class="view-container">
      <div class="view active" id="view-map" data-view="map">
        <div id="map"></div>
        <button class="map-fab layers" id="layers-btn" aria-label="Karte wechseln">🗺</button>
        <button class="map-fab filter" id="map-filter-btn" aria-label="Filter">
          <span>🔍</span>
          <span class="badge-count hidden" id="map-filter-count">0</span>
        </button>
        <button class="map-fab locate" id="locate-btn" aria-label="Standort">📍</button>
      </div>
      <div class="view" id="view-list" data-view="list"></div>
      <div class="view" id="view-bucket" data-view="bucket"></div>
      <div class="view" id="view-stats" data-view="stats"></div>
      <div class="view" id="view-settings" data-view="settings"></div>
      <div class="view" id="view-detail" data-view="detail"></div>
    </div>
    <div class="tabbar" id="tabbar"></div>
    <div class="sheet-overlay" id="sheet-overlay"></div>
    <div class="sheet" id="filter-sheet"></div>
    <div class="toast" id="toast"></div>
  `;

  const tabbar = document.getElementById('tabbar');
  for (const t of TABS) {
    const b = document.createElement('button');
    b.dataset.tab = t.id;
    b.innerHTML = `<span class="tab-icon">${t.icon}</span><span>${t.label}</span>`;
    b.addEventListener('click', () => {
      if (t.id === 'bucket') {
        store.setFilter('onlyBucket', true);
        store.setView('list');
      } else {
        if (store.getState().filters.onlyBucket && t.id === 'list') {
          store.setFilter('onlyBucket', false);
        }
        store.setView(t.id);
      }
    });
    tabbar.appendChild(b);
  }

  document.getElementById('sheet-overlay').addEventListener('click', closeAllSheets);
  document.getElementById('locate-btn').addEventListener('click', requestLocation);
  document.getElementById('layers-btn').addEventListener('click', toggleMapLayer);
  document.getElementById('map-filter-btn').addEventListener('click', openFilterSheet);
}

function showView(name) {
  for (const v of root.querySelectorAll('.view')) {
    v.classList.toggle('active', v.dataset.view === name);
  }
  for (const b of document.getElementById('tabbar').children) {
    let activeTab = name;
    const f = store.getState().filters;
    if (name === 'list' && f.onlyBucket) activeTab = 'bucket';
    if (name === 'detail') activeTab = 'map';
    b.classList.toggle('active', b.dataset.tab === activeTab);
  }
  const title = document.getElementById('topbar-title');
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';
  if (name === 'map') {
    title.textContent = 'Bikepark Map';
  } else if (name === 'list') {
    title.textContent = store.getState().filters.onlyBucket ? 'Wishlist' : 'Alle Parks';
    addAction(actions, '🔍 Filter', openFilterSheet);
  } else if (name === 'stats') {
    title.textContent = 'Deine Statistik';
  } else if (name === 'settings') {
    title.textContent = 'Mehr';
  } else if (name === 'detail') {
    title.textContent = '';
  }

  // Update filter badge on map FAB
  const count = store.activeFilterCount();
  const badge = document.getElementById('map-filter-count');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function addAction(container, label, onClick) {
  const b = document.createElement('button');
  const count = store.activeFilterCount();
  if (count > 0 && label.includes('Filter')) {
    b.innerHTML = `${label}<span class="badge-count">${count}</span>`;
    b.classList.add('primary');
  } else {
    b.innerHTML = label;
  }
  b.addEventListener('click', onClick);
  container.appendChild(b);
}

function openFilterSheet() {
  const sheet = document.getElementById('filter-sheet');
  renderFilterSheet(sheet, () => closeAllSheets());
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}

function closeAllSheets() {
  document.getElementById('sheet-overlay').classList.remove('open');
  document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('open'));
}

async function requestLocation() {
  try {
    showToast('Standort wird ermittelt …');
    await geo.getOnce();
    showToast('Standort gefunden', 'success');
  } catch (err) {
    showToast('Standort nicht verfügbar', 'error');
  }
}

function toggleMapLayer() {
  window.dispatchEvent(new CustomEvent('toggle-map-layer'));
}

window.addEventListener('map-layer-changed', (e) => {
  showToast(e.detail.label, '');
});

function rerender() {
  const s = store.getState();
  showView(s.view);
  if (s.view === 'list' || s.view === 'bucket') {
    renderList(document.getElementById(s.view === 'bucket' ? 'view-bucket' : 'view-list'));
  } else if (s.view === 'stats') {
    renderStats(document.getElementById('view-stats'));
  } else if (s.view === 'settings') {
    renderSettings(document.getElementById('view-settings'));
  } else if (s.view === 'detail') {
    renderDetail(document.getElementById('view-detail'), s.detailParkId);
  }
  refreshMarkers();
}

async function boot() {
  buildShell();
  await store.init();
  renderMap(document.getElementById('map'));
  store.onChange(rerender);
  rerender();

  try {
    await geo.getOnce({ timeout: 4000 });
    refreshMarkers();
  } catch {}

  const splash = document.getElementById('boot-splash');
  if (splash) {
    splash.style.transition = 'opacity 400ms';
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 400);
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get('share') === '1') {
    handleShareTarget();
    url.searchParams.delete('share');
    history.replaceState(null, '', url);
  }
}

window.addEventListener('park:open', (e) => {
  store.setView('detail', e.detail.parkId);
  focusPark(e.detail.parkId);
});

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<div style="color:#fff;padding:30px;font-family:system-ui">Start fehlgeschlagen: ${err.message}</div>`;
});
