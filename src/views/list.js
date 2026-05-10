import * as store from '../lib/store.js';
import { distanceTo } from '../lib/store.js';
import { formatDistance } from '../lib/geo.js';

export function renderList(container) {
  const s = store.getState();
  const parks = store.listFilteredSorted();
  const onlyBucket = s.filters.onlyBucket;
  const onlyVisited = s.filters.onlyVisited;

  container.innerHTML = `
    <div class="list-wrap">
      <div class="search-row">
        <input type="search" id="search-input" placeholder="Park, Region, Tag…" value="${escapeAttr(s.search)}" autocomplete="off" />
        <select id="sort-select">
          <option value="distance" ${s.sort === 'distance' ? 'selected' : ''}>Entfernung</option>
          <option value="name" ${s.sort === 'name' ? 'selected' : ''}>Name A–Z</option>
          <option value="rating" ${s.sort === 'rating' ? 'selected' : ''}>Bewertung</option>
          <option value="difficulty" ${s.sort === 'difficulty' ? 'selected' : ''}>Schwierigkeit</option>
          <option value="price" ${s.sort === 'price' ? 'selected' : ''}>Preis</option>
          <option value="visited" ${s.sort === 'visited' ? 'selected' : ''}>Zuletzt besucht</option>
        </select>
      </div>
      ${parks.length === 0 ? renderEmpty(onlyBucket, onlyVisited) : ''}
      <div class="park-list" id="park-list">
        ${parks.map(renderCard).join('')}
      </div>
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
        <p>Noch keine Parks auf der Wishlist.<br>Tippe in einem Park-Detail auf "Wishlist", um ihn hier zu sehen.</p>
      </div>`;
  }
  if (onlyVisited) {
    return `
      <div class="empty">
        <div class="emoji">🚵</div>
        <p>Noch keine Parks gefahren.<br>Markiere im Detail einen Park als gefahren!</p>
      </div>`;
  }
  return `
    <div class="empty">
      <div class="emoji">🔍</div>
      <p>Keine Parks für diese Filter gefunden.<br>Filter zurücksetzen oder Suche anpassen.</p>
    </div>`;
}

function renderCard(park) {
  const v = store.getVisit(park.id);
  const inBucket = store.isInBucket(park.id);
  const dist = distanceTo(park);
  const flagClass = `flag-${(park.country || 'other').toLowerCase()}`;
  const difficulties = ['green', 'blue', 'red', 'black', 'double_black'];
  const has = new Set(park.difficulties || []);
  const sessions = v?.sessions?.length || 0;
  const rating = v?.rating || 0;
  return `
    <button class="park-card" data-park-id="${park.id}">
      <div class="pc-head">
        <div>
          <div class="pc-name ${flagClass}">${escapeHtml(park.name)}</div>
          <div class="pc-meta">
            ${escapeHtml(park.region || '')}${dist != null ? ` · ${formatDistance(dist)}` : ''}
          </div>
        </div>
        <div class="pc-flag">${park.country === 'OTHER' ? '📍' : ''}</div>
      </div>
      <div class="diff-grid">
        ${difficulties.map((d) => `<div class="diff-cell ${d} ${has.has(d) ? 'has' : ''}"></div>`).join('')}
      </div>
      <div class="pc-status">
        ${(park.lift || []).filter(Boolean).slice(0, 2).map((l) => `<span class="badge">${liftIcon(l)} ${store.LIFT_LABELS[l] || l}</span>`).join('')}
        ${park.elevation?.vertical ? `<span class="badge">📏 ${park.elevation.vertical} hm</span>` : ''}
        ${park.trailKm ? `<span class="badge">🛤 ${park.trailKm} km</span>` : ''}
        ${park.prices?.dayPass != null ? `<span class="badge">${formatPrice(park.prices)}</span>` : park.prices?.dayPass === 0 ? `<span class="badge green">kostenlos</span>` : ''}
        ${sessions > 0 ? `<span class="badge visited">✓ ${sessions}× gefahren</span>` : ''}
        ${inBucket && sessions === 0 ? `<span class="badge bucket">★ Wishlist</span>` : ''}
        ${park.isCustom ? `<span class="badge">eigener Park</span>` : ''}
      </div>
      ${rating > 0 ? `<div class="pc-rating">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>` : ''}
    </button>
  `;
}

function liftIcon(l) {
  return ({ gondola: '🚠', chairlift: '🚡', tbar: '🪝', funicular: '🚞', cablecar: '🚠', shuttle: '🚐', coaster: '🛷', none: '🚲' })[l] || '🚡';
}

function formatPrice(prices) {
  const cur = prices.currency === 'CHF' ? 'CHF' : '€';
  if (prices.dayPass === 0) return 'kostenlos';
  return `${cur === '€' ? '€' : 'CHF '}${prices.dayPass}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
