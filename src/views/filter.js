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
    <div class="sheet-title">
      <span>Filter</span>
      <button id="filter-reset">Zurücksetzen</button>
    </div>

    <div class="filter-section">
      <h4>Land</h4>
      <div class="chip-group" id="filter-country">
        ${countries.map((c) => `
          <button class="chip ${f.countries.has(c) ? 'active' : ''}" data-c="${c}">
            ${store.COUNTRY_FLAGS[c]} ${store.COUNTRY_NAMES[c]}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Schwierigkeit</h4>
      <div class="chip-group" id="filter-diff">
        ${allDiffs.map((d) => `
          <button class="chip ${f.difficulties.has(d) ? 'active' : ''}" data-d="${d}">
            <span class="badge dot ${d}"></span> ${store.DIFFICULTY_LABELS[d]}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Bike-Typ</h4>
      <div class="chip-group" id="filter-biketype">
        ${allBikeTypes.map((t) => `
          <button class="chip ${f.bikeTypes.has(t) ? 'active' : ''}" data-t="${t}">${store.BIKE_TYPE_LABELS[t]}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Lift</h4>
      <div class="chip-group" id="filter-lift">
        ${allLifts.map((l) => `
          <button class="chip ${f.lifts.has(l) ? 'active' : ''}" data-l="${l}">${store.LIFT_LABELS[l]}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Ausstattung</h4>
      <div class="chip-group" id="filter-amenity">
        ${allAmen.map((a) => `
          <button class="chip ${f.amenities.has(a) ? 'active' : ''}" data-a="${a}">${store.AMENITY_ICONS[a] || ''} ${store.AMENITY_LABELS[a]}</button>
        `).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Max. Tagespreis</h4>
      <div class="range-row">
        <input type="range" id="filter-price" min="0" max="100" step="5" value="${f.maxPrice == null ? 100 : f.maxPrice}" />
        <span class="range-val" id="price-val">${f.maxPrice == null ? 'beliebig' : '€ ' + f.maxPrice}</span>
      </div>
    </div>

    <div class="filter-section">
      <h4>Max. Entfernung</h4>
      <div class="range-row">
        <input type="range" id="filter-dist" min="0" max="800" step="25" value="${f.maxDistance == null ? 800 : f.maxDistance}" />
        <span class="range-val" id="dist-val">${f.maxDistance == null ? 'beliebig' : f.maxDistance + ' km'}</span>
      </div>
      <p class="note">Nur aktiv wenn Standort verfügbar.</p>
    </div>

    <div class="filter-section">
      <h4>Mindest-Bewertung (deine)</h4>
      <div class="chip-group" id="filter-rating">
        ${[0,1,2,3,4,5].map((n) => `<button class="chip ${f.minRating === n ? 'active' : ''}" data-r="${n}">${n === 0 ? 'beliebig' : '★'.repeat(n)}</button>`).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Spezial</h4>
      <div class="chip-group" id="filter-special">
        <button class="chip ${f.onlyOpen ? 'active' : ''}" data-s="onlyOpen">🟢 Aktuell geöffnet</button>
        <button class="chip ${f.onlyVisited ? 'active' : ''}" data-s="onlyVisited">✅ Nur gefahrene</button>
        <button class="chip ${f.onlyBucket ? 'active' : ''}" data-s="onlyBucket">⭐ Nur Wishlist</button>
      </div>
    </div>

    <button class="btn-primary" id="filter-apply">Anwenden (${store.applyFilters().length} Parks)</button>
  `;

  bindChips(container, '#filter-country', 'data-c', (v) => store.toggleSetMember('countries', v));
  bindChips(container, '#filter-diff', 'data-d', (v) => store.toggleSetMember('difficulties', v));
  bindChips(container, '#filter-biketype', 'data-t', (v) => store.toggleSetMember('bikeTypes', v));
  bindChips(container, '#filter-lift', 'data-l', (v) => store.toggleSetMember('lifts', v));
  bindChips(container, '#filter-amenity', 'data-a', (v) => store.toggleSetMember('amenities', v));
  for (const b of container.querySelectorAll('#filter-rating .chip')) {
    b.addEventListener('click', () => {
      const r = parseInt(b.dataset.r, 10);
      store.setFilter('minRating', r);
    });
  }
  for (const b of container.querySelectorAll('#filter-special .chip')) {
    b.addEventListener('click', () => {
      const k = b.dataset.s;
      store.setFilter(k, !store.getState().filters[k]);
    });
  }
  const priceInput = container.querySelector('#filter-price');
  const priceVal = container.querySelector('#price-val');
  priceInput.addEventListener('input', () => {
    const v = parseInt(priceInput.value, 10);
    priceVal.textContent = v === 100 ? 'beliebig' : '€ ' + v;
    store.setFilter('maxPrice', v === 100 ? null : v);
  });
  const distInput = container.querySelector('#filter-dist');
  const distVal = container.querySelector('#dist-val');
  distInput.addEventListener('input', () => {
    const v = parseInt(distInput.value, 10);
    distVal.textContent = v === 800 ? 'beliebig' : v + ' km';
    store.setFilter('maxDistance', v === 800 ? null : v);
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
      // update apply count
      const applyBtn = container.querySelector('#filter-apply');
      if (applyBtn) applyBtn.textContent = `Anwenden (${store.applyFilters().length} Parks)`;
    });
  }
}
