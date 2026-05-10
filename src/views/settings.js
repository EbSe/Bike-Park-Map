import * as store from '../lib/store.js';
import * as db from '../lib/db.js';
import { showToast } from './toast.js';
import { renderAddParkSheet } from './add-park.js';

export function renderSettings(container) {
  container.innerHTML = `
    <div class="settings-wrap">

      <div class="section-card">
        <div class="head">Eigene Parks</div>
        <button class="item-btn" id="add-park">
          <div class="icon-wrap">➕</div>
          <div class="lbl-stack">
            <div class="lbl">Park hinzufügen</div>
            <div class="sub">Vereinspark oder neuen Spot pinnen</div>
          </div>
          <div class="chevron">›</div>
        </button>
      </div>

      <div class="section-card">
        <div class="head">Datenmanagement</div>
        <button class="item-btn" id="export-data">
          <div class="icon-wrap">📤</div>
          <div class="lbl-stack">
            <div class="lbl">Daten exportieren</div>
            <div class="sub">JSON-Backup deiner Sessions, Bewertungen & Fotos</div>
          </div>
          <div class="chevron">›</div>
        </button>
        <button class="item-btn" id="import-data">
          <div class="icon-wrap">📥</div>
          <div class="lbl-stack">
            <div class="lbl">Daten importieren</div>
            <div class="sub">JSON-Backup einspielen (ergänzt vorhandene Daten)</div>
          </div>
          <div class="chevron">›</div>
        </button>
        <input type="file" id="import-file" accept=".json,application/json" hidden />
        <button class="item-btn danger" id="reset-data">
          <div class="icon-wrap">🗑️</div>
          <div class="lbl-stack">
            <div class="lbl" style="color:var(--danger)">Alle Daten löschen</div>
            <div class="sub">Setzt eigene Daten zurück – Park-Datenbank bleibt</div>
          </div>
          <div class="chevron">›</div>
        </button>
      </div>

      <div class="section-card">
        <div class="head">Über die App</div>
        <div class="item">
          <div class="lbl-stack">
            <div class="lbl">App-Version</div>
            <div class="sub">1.1.0 · 84 kuratierte Parks (400 km um Ravensburg)</div>
          </div>
        </div>
        <div class="item">
          <div class="lbl-stack">
            <div class="lbl">Datenstand</div>
            <div class="sub">Recherchiert 2024 · vor Besuch immer Webseite checken</div>
          </div>
        </div>
        <div class="item">
          <div class="lbl-stack">
            <div class="lbl">Offline-Modus</div>
            <div class="sub">Karten-Tiles werden gecached. Schon besuchte Parks funktionieren offline.</div>
          </div>
        </div>
      </div>

      <div class="notice">
        <strong>Datenschutz.</strong> Alle Daten (Sessions, Bewertungen, Fotos, eigene Parks) liegen <b>ausschließlich auf deinem Gerät</b>. Keine Anmeldung, kein Backend, keine Tracking-Cookies, kein Analytics. Karten © OpenStreetMap-Mitwirkende · Wetter: Open-Meteo.com.
      </div>
    </div>
  `;

  container.querySelector('#add-park').addEventListener('click', () => openAddParkSheet());

  container.querySelector('#export-data').addEventListener('click', async () => {
    showToast('Exportiere …');
    try {
      const data = await db.exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bikepark-map-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Backup erstellt', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  const importFile = container.querySelector('#import-file');
  container.querySelector('#import-data').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!confirm('Backup einspielen? Bestehende Daten werden ergänzt.')) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      await db.importAll(data, { merge: true });
      await store.init();
      showToast('Backup eingespielt', 'success');
    } catch (err) {
      showToast(`Import fehlgeschlagen: ${err.message}`, 'error');
    } finally {
      importFile.value = '';
    }
  });

  container.querySelector('#reset-data').addEventListener('click', async () => {
    if (!confirm('Wirklich ALLE deine Daten löschen? (Sessions, Bewertungen, Fotos, eigene Parks)')) return;
    if (!confirm('Letzte Warnung: alle Daten gehen verloren. Fortfahren?')) return;
    await db.clear('visits');
    await db.clear('media');
    await db.clear('customParks');
    await db.clear('bucket');
    await db.clear('tracks');
    await store.init();
    showToast('Alle Daten gelöscht');
  });
}

function openAddParkSheet() {
  const sheet = document.getElementById('filter-sheet');
  renderAddParkSheet(sheet, () => {
    sheet.classList.remove('open');
    document.getElementById('sheet-overlay').classList.remove('open');
  });
  sheet.classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
}
