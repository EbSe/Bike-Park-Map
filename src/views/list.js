import * as store from '../lib/store.js';
import { distanceTo } from '../lib/store.js';
import { formatDistance } from '../lib/geo.js';
import { tileUrl } from '../lib/map-tile.js';

const QUICK_FILTERS = [
  { id: 'onlyOpen', label: 'Geöffnet', icon: '🟢' },
  { id: 'onlyVisited', label: 'Gefahren', icon: '✓' },
  { id: 'onlyBucket', label: 'Wishlist', icon: '★' },
];

export function renderList(container) {
  const s = store.getState();
  const parks = store.listFilteredSorted();
  const onlyBucket = s.filters.onlyBucket;
  const onlyVisited = s.filters.onlyVisited;

  container.innerHTML = `
    <div class="list-wrap">
      <div class="search-sticky">
        <div class="search-input-wrap">
          <input type="search" id="search-input" placeholder="Park, Region, Tag…" value="${escapeAttr(s.search)}" autocomplete="off" enterkeyhint="search" />
        </div>
        <div class="list-toolbar">
          ${QUICK_FILTERS.map((q) => `
            <button class="quick-chip ${s.filters[q.id] ? 'active' : ''}" data-quick="${q.id}">
              <span class="ico">${q.icon}</span>${q.label}
            </button>
          `).join('')}
          <button class="quick-chip" data-near="1">📍 In der Nähe</button>
          <select class="sort-chip" id="sort-select" aria-label="Sortierung">
            <option value="distance" ${s.sort === 'distance' ? 'selected' : ''}>↕ Entfernung</option>
            <option value="name" ${s.sort === 'name' ? 'selected' : ''}>↕ A–Z</option>
            <option value="rating" ${s.sort === 'rating' ? 'selected' : ''}>↕ Bewertung</option>
            <option value="difficulty" ${s.sort === 'difficulty' ? 'selected' : ''}>↕ Schwierigkeit</option>
            <option value="price" ${s.sort === 'price' ? 'selected' : ''}>↕ Preis</option>
            <option value="visited" ${s.sort === 'visited' ? 'selected' : ''}>↕ Zuletzt besucht</option>
          </select>
        </div>
      </div>
      ${parks.length === 0 ? renderEmpty(onlyBucket, onlyVisited) : `
        <div class="result-count">${parks.length} Park${parks.length !== 1 ? 's' : ''}</div>
        <div class="list-results">
          ${parks.map(renderCard).join('')}
        </div>
      `}
    </div>
  `;

  const search = container.querySelector('#search-input');
  if (search) {
    let timer;
    search.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => store.setSearch(e.target.value), 200);
    });
  }
  const sortSel = container.querySelector('#sort-select');
  if (sortSel) sortSel.addEventListener('change', (e) => store.setSort(e.target.value));

  container.querySelectorAll('[data-quick]').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.quick;
      store.setFilter(k, !store.getState().filters[k]);
    });
  });
  const nearBtn = container.querySelector('[data-near]');
  if (nearBtn) {
    nearBtn.addEventListener('click', () => {
      store.setSort('distance');
      store.setFilter('maxDistance', 100);
    });
  }

  for (const card of container.querySelectorAll('.park-card')) {
    card.addEventListener('click', () => {
      const id = card.dataset.parkId;
      window.dispatchEvent(new CustomEvent('park:open', { detail: { parkId: id } }));
    });
  }
}

function renderEmpty(onlyBucket, onlyVisited) {
  if (onlyBucket) {
    return `
      <div class="empty">
        <div class="emoji">⭐</div>
        <div class="title">Wishlist ist leer</div>
        <div class="sub">Öffne einen Park und tippe auf "Wishlist", um ihn hier zu sammeln.</div>
      </div>`;
  }
  if (onlyVisited) {
    return `
      <div class="empty">
        <div class="emoji">🚵</div>
        <div class="title">Noch keine Sessions</div>
        <div class="sub">Markiere im Detail einen Park als gefahren oder importiere einen GPX/FIT-Track.</div>
      </div>`;
  }
  return `
    <div class="empty">
      <div class="emoji">🔍</div>
      <div class="title">Keine Parks gefunden</div>
      <div class="sub">Filter zurücksetzen oder Suche anpassen.</div>
    </div>`;
}

function renderCard(park) {
  const v = store.getVisit(park.id);
  const inBucket = store.isInBucket(park.id);
  const sessions = v?.sessions?.length || 0;
  const visited = sessions > 0;
  const dist = distanceTo(park);
  const flag = store.COUNTRY_FLAGS[park.country] || '📍';
  const difficulties = ['green', 'blue', 'red', 'black', 'double_black'];
  const has = new Set(park.difficulties || []);
  const rating = v?.rating || 0;
  const classNames = ['park-card'];
  if (visited) classNames.push('is-visited');
  else if (inBucket) classNames.push('is-bucket');

  const liftIcon = primaryLiftIcon(park.lift);
  const priceStr = formatPriceShort(park.prices);

  const tileSrc = tileUrl(park.lat, park.lon, 12, 'dark');

  return `
    <button class="${classNames.join(' ')}" data-park-id="${park.id}">
      <div class="pc-hero">
        <img class="pc-hero-img" loading="lazy" src="${tileSrc}" alt="" />
        <div class="pc-hero-fade"></div>
        <div class="pc-hero-flag">${flag}</div>
        ${dist != null ? `<div class="pc-hero-distance">
          <span class="km">${formatDistance(dist)}</span>
        </div>` : ''}
        ${visited ? `<div class="pc-hero-badge success">✓ gefahren</div>` : ''}
        ${inBucket && !visited ? `<div class="pc-hero-badge warm">★ Wishlist</div>` : ''}
      </div>

      <div class="pc-body">
        <h3 class="pc-title">${escapeHtml(park.name)}</h3>
        <div class="pc-subtitle">${escapeHtml(park.region || '')}</div>

        <div class="diff-row" style="margin-top:10px">
          ${difficulties.map((d) => `<div class="diff-pill ${d} ${has.has(d) ? 'has' : ''}"></div>`).join('')}
        </div>

        <div class="pc-meta-row">
          ${liftIcon ? `<span class="stat-pill"><span class="ico">${liftIcon}</span>${liftLabelShort(park.lift)}</span>` : ''}
          ${park.elevation?.vertical ? `<span class="stat-pill"><span class="ico">⛰</span>${park.elevation.vertical} hm</span>` : ''}
          ${park.trailKm ? `<span class="stat-pill"><span class="ico">🛤</span>${park.trailKm} km</span>` : ''}
          ${priceStr ? `<span class="stat-pill ${park.prices?.dayPass === 0 ? 'success' : 'accent'}">${priceStr}</span>` : ''}
          ${park.isCustom ? `<span class="stat-pill muted">eigener</span>` : ''}
          ${rating > 0 ? `<span class="pc-rating">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>` : ''}
        </div>
      </div>
    </button>
  `;
}

function primaryLiftIcon(lifts) {
  if (!lifts || lifts.length === 0) return '';
  const order = ['gondola', 'cablecar', 'funicular', 'chairlift', 'tbar', 'shuttle', 'coaster', 'none'];
  const sorted = lifts.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return ({ gondola: '🚠', cablecar: '🚠', funicular: '🚞', chairlift: '🚡', tbar: '🪝', shuttle: '🚐', coaster: '🛷', none: '🚲' })[sorted[0]] || '🚡';
}
function liftLabelShort(lifts) {
  if (!lifts || lifts.length === 0) return '';
  if (lifts.includes('none')) return 'kein Lift';
  if (lifts.includes('gondola')) return 'Gondel';
  if (lifts.includes('chairlift')) return 'Sessellift';
  if (lifts.includes('cablecar')) return 'Seilbahn';
  if (lifts.includes('funicular')) return 'Standseilb.';
  if (lifts.includes('shuttle')) return 'Shuttle';
  return store.LIFT_LABELS[lifts[0]] || lifts[0];
}
function formatPriceShort(prices) {
  if (!prices || prices.dayPass == null) return '';
  if (prices.dayPass === 0) return 'gratis';
  const cur = prices.currency === 'CHF' ? 'CHF' : '€';
  return `${cur === '€' ? '€' : 'CHF '}${prices.dayPass}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
