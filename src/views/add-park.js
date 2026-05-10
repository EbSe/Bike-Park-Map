import * as store from '../lib/store.js';
import * as db from '../lib/db.js';
import * as geo from '../lib/geo.js';
import { showToast } from './toast.js';

export function renderAddParkSheet(container, onClose) {
  const allBikeTypes = Object.keys(store.BIKE_TYPE_LABELS);
  const allDiffs = ['green', 'blue', 'red', 'black', 'double_black'];
  const allLifts = ['gondola', 'chairlift', 'tbar', 'funicular', 'cablecar', 'shuttle', 'coaster', 'none'];
  const allAmen = Object.keys(store.AMENITY_LABELS);
  const userPos = geo.getUserPos();

  container.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">
      <span>Neuen Park hinzufügen</span>
      <button id="ap-cancel">Abbrechen</button>
    </div>

    <div class="filter-section">
      <h4>Name *</h4>
      <input type="text" id="ap-name" placeholder="z.B. Bikepark Kleinhausen" style="width:100%" />
    </div>

    <div class="filter-section">
      <h4>Region</h4>
      <input type="text" id="ap-region" placeholder="z.B. Bayern (Allgäu)" style="width:100%" />
    </div>

    <div class="filter-section">
      <h4>Land</h4>
      <div class="chip-group" id="ap-country">
        ${['DE','AT','CH','IT','OTHER'].map((c) => `<button class="chip ${c === 'DE' ? 'active' : ''}" data-c="${c}">${store.COUNTRY_FLAGS[c]} ${store.COUNTRY_NAMES[c]}</button>`).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Standort *</h4>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input type="number" id="ap-lat" placeholder="Latitude" step="any" style="flex:1" value="${userPos ? userPos.lat.toFixed(5) : ''}" />
        <input type="number" id="ap-lon" placeholder="Longitude" step="any" style="flex:1" value="${userPos ? userPos.lon.toFixed(5) : ''}" />
      </div>
      <button class="btn-secondary" id="ap-current">📍 Aktuelle Position einsetzen</button>
      <p class="note">Tipp: in Google Maps/Apple Maps lange auf den Park-Standort drücken → Koordinaten kopieren.</p>
    </div>

    <div class="filter-section">
      <h4>Schwierigkeiten</h4>
      <div class="chip-group" id="ap-diff">
        ${allDiffs.map((d) => `<button class="chip" data-d="${d}"><span class="badge dot ${d}"></span> ${store.DIFFICULTY_LABELS[d]}</button>`).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Bike-Typen</h4>
      <div class="chip-group" id="ap-types">
        ${allBikeTypes.map((t) => `<button class="chip" data-t="${t}">${store.BIKE_TYPE_LABELS[t]}</button>`).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Lifte</h4>
      <div class="chip-group" id="ap-lift">
        ${allLifts.map((l) => `<button class="chip" data-l="${l}">${store.LIFT_LABELS[l]}</button>`).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Ausstattung</h4>
      <div class="chip-group" id="ap-amen">
        ${allAmen.map((a) => `<button class="chip" data-a="${a}">${store.AMENITY_ICONS[a]} ${store.AMENITY_LABELS[a]}</button>`).join('')}
      </div>
    </div>

    <div class="filter-section">
      <h4>Tagespass (€)</h4>
      <input type="number" id="ap-price" placeholder="z.B. 15 oder 0 für kostenlos" min="0" max="200" style="width:100%" />
    </div>

    <div class="filter-section">
      <h4>Webseite</h4>
      <input type="url" id="ap-homepage" placeholder="https://…" style="width:100%" />
    </div>

    <div class="filter-section">
      <h4>Beschreibung / Notizen</h4>
      <textarea class="notes-area" id="ap-desc" placeholder="Was zeichnet den Park aus?"></textarea>
    </div>

    <button class="btn-primary" id="ap-save">Park speichern</button>
  `;

  // multi-select chips
  const setupMulti = (sel, attr) => {
    const set = new Set();
    for (const b of container.querySelectorAll(`${sel} .chip`)) {
      b.addEventListener('click', () => {
        b.classList.toggle('active');
        const val = b.getAttribute(attr);
        if (set.has(val)) set.delete(val); else set.add(val);
      });
    }
    return set;
  };

  // Country: single-select
  let country = 'DE';
  for (const b of container.querySelectorAll('#ap-country .chip')) {
    b.addEventListener('click', () => {
      for (const x of container.querySelectorAll('#ap-country .chip')) x.classList.remove('active');
      b.classList.add('active');
      country = b.dataset.c;
    });
  }

  const diffSet = setupMulti('#ap-diff', 'data-d');
  const typeSet = setupMulti('#ap-types', 'data-t');
  const liftSet = setupMulti('#ap-lift', 'data-l');
  const amenSet = setupMulti('#ap-amen', 'data-a');

  container.querySelector('#ap-current').addEventListener('click', async () => {
    try {
      showToast('Standort wird ermittelt…');
      const p = await geo.getOnce();
      container.querySelector('#ap-lat').value = p.lat.toFixed(5);
      container.querySelector('#ap-lon').value = p.lon.toFixed(5);
      showToast('Standort gesetzt');
    } catch (err) {
      showToast('Standort nicht verfügbar', 'error');
    }
  });

  container.querySelector('#ap-cancel').addEventListener('click', onClose);

  container.querySelector('#ap-save').addEventListener('click', async () => {
    const name = container.querySelector('#ap-name').value.trim();
    const region = container.querySelector('#ap-region').value.trim();
    const lat = parseFloat(container.querySelector('#ap-lat').value);
    const lon = parseFloat(container.querySelector('#ap-lon').value);
    const homepage = container.querySelector('#ap-homepage').value.trim();
    const description = container.querySelector('#ap-desc').value.trim();
    const priceVal = container.querySelector('#ap-price').value;
    const dayPass = priceVal === '' ? null : parseInt(priceVal, 10);

    if (!name) return showToast('Name fehlt', 'error');
    if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return showToast('Standort ungültig', 'error');
    }

    const park = {
      name, region, country,
      lat, lon,
      lift: [...liftSet],
      bikeTypes: [...typeSet],
      difficulties: [...diffSet],
      amenities: [...amenSet],
      prices: dayPass != null ? { currency: country === 'CH' ? 'CHF' : 'EUR', dayPass } : null,
      homepage: homepage || null,
      description: description || null,
      tags: ['custom'],
      isCustom: true,
    };

    try {
      await db.saveCustomPark(park);
      await store.init();
      showToast('Park gespeichert');
      onClose && onClose();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
