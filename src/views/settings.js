import * as store from '../lib/store.js';
import * as db from '../lib/db.js';
import { showToast } from './toast.js';
import { renderAddParkSheet } from './add-park.js';

export function renderSettings(container) {
  container.innerHTML = `
    <div class="list-wrap">
      <div class="filter-section">
        <h4>Eigene Parks</h4>
        <button class="btn-primary" id="add-park">➕ Eigenen Park / Vereinspark hinzufügen</button>
        <p class="note">Kennst du einen Park, der noch nicht erfasst ist? Pinne ihn auf der Karte, gib Details ein und er erscheint überall in der App.</p>
      </div>

      <div class="filter-section">
        <h4>Backup & Wiederherstellen</h4>
        <button class="btn-secondary" id="export-data">📤 Daten exportieren (JSON)</button>
        <p class="note" style="margin-top:6px">Sichert alle deine Sessions, Bewertungen, Fotos & eigenen Parks in eine Datei. Alle Daten sind nur lokal auf deinem Gerät – per Export kannst du sie z.B. via AirDrop auf ein neues iPhone übertragen.</p>
        <input type="file" id="import-file" accept=".json,application/json" hidden />
        <button class="btn-secondary" id="import-data" style="margin-top:10px">📥 Daten importieren</button>
        <button class="btn-danger" id="reset-data" style="margin-top:10px;width:100%">🗑️ Alle eigenen Daten löschen</button>
      </div>

      <div class="filter-section">
        <h4>App</h4>
        <div class="row">
          <div class="lbl-stack">
            <span>App-Version</span>
            <span class="sub">1.0.0</span>
          </div>
        </div>
        <div class="row">
          <div class="lbl-stack">
            <span>Bikeparks erfasst</span>
            <span class="sub">${store.getState().parks.length} Parks (inkl. eigener)</span>
          </div>
        </div>
        <div class="row">
          <div class="lbl-stack">
            <span>Service Worker / Offline</span>
            <span class="sub">Karten-Tiles werden gecached. Schon einmal besuchte Parks funktionieren offline.</span>
          </div>
        </div>
      </div>

      <div class="filter-section">
        <h4>Hinweis zu Daten</h4>
        <p class="note">Preise, Saisonzeiten und Streckendaten sind sorgfältig recherchiert (Stand 2024), können sich aber ändern. <b>Vor dem Besuch immer die offizielle Webseite des Parks checken.</b></p>
        <p class="note">Karten: © OpenStreetMap-Mitwirkende. Wetter: Open-Meteo.com. Diese App nutzt keine Tracking-Cookies.</p>
      </div>
    </div>
  `;

  container.querySelector('#add-park').addEventListener('click', () => openAddParkSheet());

  container.querySelector('#export-data').addEventListener('click', async () => {
    showToast('Exportiere…');
    try {
      const data = await db.exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bikepark-map-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Backup erstellt');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  const importFile = container.querySelector('#import-file');
  container.querySelector('#import-data').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!confirm('Backup-Datei einspielen? Bestehende Daten werden ergänzt (nicht überschrieben).')) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      await db.importAll(data, { merge: true });
      await store.init();
      showToast('Backup eingespielt');
    } catch (err) {
      showToast(`Import fehlgeschlagen: ${err.message}`, 'error');
    } finally {
      importFile.value = '';
    }
  });

  container.querySelector('#reset-data').addEventListener('click', async () => {
    if (!confirm('Wirklich ALLE deine Daten (Sessions, Bewertungen, Fotos, eigene Parks) löschen? Das kann nicht rückgängig gemacht werden.')) return;
    if (!confirm('Letzte Warnung: alle Daten werden gelöscht. Fortfahren?')) return;
    await db.clear('visits');
    await db.clear('media');
    await db.clear('customParks');
    await db.clear('bucket');
    await db.clear('tracks');
    await store.init();
    showToast('Alle eigenen Daten gelöscht');
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
