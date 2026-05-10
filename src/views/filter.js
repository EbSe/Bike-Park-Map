import * as store from '../lib/store.js';

export function renderFilterSheet(container, onApply) {
  const f = store.getState().filters;
  const allBikeTypes = Object.keys(store.BIKE_TYPE_LABELS);
  const allDiffs = ['green', 'blue', 'red', 'black', 'double_black'];
  const allLifts = ['gondola', 'chairlift', 'tbar', 'funicular', 'cablecar', 'shuttle', 'coaster', 'none'];
  const allAmen = Object.keys(store.AMENITY_LABELS);
  const countries = ['DE', 'AT', 'CH', 'IT'];

  container.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <h2 class="sheet-title">Filter</h2>
      <button class="sheet-action" id="filter-reset">Zurücksetzen</button>
    </div>

    <div class="filter-group">
      <h4>Land</h4>
      <div class="chip-group" id="filter-country">
        ${countries.map((c) => `
          <button class="chip ${f.countries.has(c) ? 'active' : ''}" data-c="${c}">
            ${store.COUNTRY_FLAGS[c]} ${store.COUNTRY_NAMES[c]}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="filter-group">
      <h4>Schwierigkeit</h4>
      <div class="chip-group" id="filter-diff">
        ${allDiffs.map((d) => `
          <button class="chip diff-chip ${f.difficulties.has(d) ? 'active' : ''}" data-d="${d}">
            <span class="dot ${d}"></span> ${store.DIFFICULTY_LABELS[d]}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="filter-group">
      <h4>Bike-Typ</h4>
      <div class="chip-group" id="filter-biketype">
        ${allBikeTypes.map((t) => `
          <button class="chip ${f.bikeTypes.has(t) ? 'active' : ''}" data-t="${t}">${store.BIKE_TYPE_LABELS[t]}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-group">
      <h4>Lift</h4>
      <div class="chip-group" id="filter-lift">
        ${allLifts.map((l) => `
          <button class="chip ${f.lifts.has(l) ? 'active' : ''}" data-l="${l}">${liftIcon(l)} ${store.LIFT_LABELS[l]}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-group">
      <h4>Ausstattung</h4>
      <div class="chip-group" id="filter-amenity">
        ${allAmen.map((a) => `
          <button class="chip ${f.amenities.has(a) ? 'active' : ''}" data-a="${a}">${store.AMENITY_ICONS[a] || ''} ${store.AMENITY_LABELS[a]}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-group">
      <h4>Tagespreis</h4>
      <div class="range-group">
        <div class="range-head">
          <span>Maximal</span>
          <span class="val" id="price-val">${f.maxPrice == null ? 'beliebig' : '€ ' + f.maxPrice}</span>
        </div>
        <input type="range" id="filter-price" min="0" max="100" step="5" value="${f.maxPrice == null ? 100 : f.maxPrice}" />
      </div>
    </div>

    <div class="filter-group">
      <h4>Entfernung</h4>
      <div class="range-group">
        <div class="range-head">
          <span>Maximal</span>
          <span class="val" id="dist-val">${f.maxDistance == null ? 'beliebig' : f.maxDistance + ' km'}</span>
        </div>
        <input type="range" id="filter-dist" min="0" max="500" step="25" value="${f.maxDistance == null ? 500 : f.maxDistance}" />
      </div>
    </div>

    <div class="filter-group">
      <h4>Mindest-Bewertung</h4>
      <div class="chip-group" id="filter-rating">
        ${[0,1,2,3,4,5].map((n) => `<button class="chip ${f.minRating === n ? 'active' : ''}" data-r="${n}">${n === 0 ? 'beliebig' : '★'.repeat(n)}</button>`).join('')}
      </div>
    </div>

    <div class="filter-group">
      <h4>Spezial</h4>
      <div class="toggle-row">
        <div class="toggle ${f.onlyOpen ? 'on' : ''} first" data-s="onlyOpen">
          <span>🟢 Aktuell geöffnet</span>
          <span class="switch"></span>
        </div>
        <div class="toggle ${f.onlyVisited ? 'on' : ''} mid" data-s="onlyVisited">
          <span>✅ Nur gefahrene</span>
          <span class="switch"></span>
        </div>
        <div class="toggle ${f.onlyBucket ? 'on' : ''} last" data-s="onlyBucket">
          <span>⭐ Nur Wishlist</span>
          <span class="switch"></span>
        </div>
      </div>
    </div>

    <div class="cta-bar">
      <button class="btn btn-primary" id="filter-apply">Anwenden · ${store.applyFilters().length} Parks</button>
    </div>
  `;

  bindChips(container, '#filter-country', 'data-c', (v) => store.toggleSetMember('countries', v));
  bindChips(container, '#filter-diff', 'data-d', (v) => store.toggleSetMember('difficulties', v));
  bindChips(container, '#filter-biketype', 'data-t', (v) => store.toggleSetMember('bikeTypes', v));
  bindChips(container, '#filter-lift', 'data-l', (v) => store.toggleSetMember('lifts', v));
  bindChips(container, '#filter-amenity', 'data-a', (v) => store.toggleSetMember('amenities', v));
  for (const b of container.querySelectorAll('#filter-rating .chip')) {
    b.addEventListener('click', () => {
      for (const x of container.querySelectorAll('#filter-rating .chip')) x.classList.remove('active');
      b.classList.add('active');
      store.setFilter('minRating', parseInt(b.dataset.r, 10));
      updateCount(container);
    });
  }
  for (const t of container.querySelectorAll('.toggle[data-s]')) {
    t.addEventListener('click', () => {
      const k = t.dataset.s;
      const newVal = !store.getState().filters[k];
      store.setFilter(k, newVal);
      t.classList.toggle('on', newVal);
      updateCount(container);
    });
  }
  const priceInput = container.querySelector('#filter-price');
  const priceVal = container.querySelector('#price-val');
  priceInput.addEventListener('input', () => {
    const v = parseInt(priceInput.value, 10);
    priceVal.textContent = v === 100 ? 'beliebig' : '€ ' + v;
    store.setFilter('maxPrice', v === 100 ? null : v);
    updateCount(container);
  });
  const distInput = container.querySelector('#filter-dist');
  const distVal = container.querySelector('#dist-val');
  distInput.addEventListener('input', () => {
    const v = parseInt(distInput.value, 10);
    distVal.textContent = v === 500 ? 'beliebig' : v + ' km';
    store.setFilter('maxDistance', v === 500 ? null : v);
    updateCount(container);
  });

  container.querySelector('#filter-reset').addEventListener('click', () => {
    store.clearFilters();
    renderFilterSheet(container, onApply);
  });
  container.querySelector('#filter-apply').addEventListener('click', () => {
    onApply && onApply();
  });
}

function bindChips(container, sel, attr, fn) {
  for (const b of container.querySelectorAll(`${sel} .chip`)) {
    b.addEventListener('click', () => {
      const val = b.getAttribute(attr);
      fn(val);
      b.classList.toggle('active');
      updateCount(container);
    });
  }
}

function updateCount(container) {
  const btn = container.querySelector('#filter-apply');
  if (btn) btn.textContent = `Anwenden · ${store.applyFilters().length} Parks`;
}

function liftIcon(l) {
  return ({ gondola: '🚠', cablecar: '🚠', funicular: '🚞', chairlift: '🚡', tbar: '🪝', shuttle: '🚐', coaster: '🛷', none: '🚲' })[l] || '';
}
