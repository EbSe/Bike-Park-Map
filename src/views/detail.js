import * as store from '../lib/store.js';
import * as db from '../lib/db.js';
import * as geo from '../lib/geo.js';
import { getWeather, weatherIcon, dayLabel } from '../lib/weather.js';
import { parseTrackFile, formatDuration, trackToGPX } from '../lib/gpx.js';
import { showToast } from './toast.js';

export async function renderDetail(container, parkId) {
  const park = store.getPark(parkId);
  if (!park) {
    container.innerHTML = `<div class="empty"><div class="emoji">❓</div><p>Park nicht gefunden.</p></div>`;
    return;
  }
  const visit = store.getVisit(parkId) || { parkId, sessions: [], rating: 0, notes: '' };
  const inBucket = store.isInBucket(parkId);
  const dist = store.distanceTo(park);
  const flagClass = `flag-${(park.country || 'other').toLowerCase()}`;

  const open = store.isParkOpenToday(park);
  const openBadge = open === true ? '<span class="badge green">🟢 geöffnet</span>'
    : open === false ? '<span class="badge warn">🟠 außerhalb Saison</span>'
    : '';

  container.innerHTML = `
    <div class="detail-wrap">
      <div class="detail-hero">
        <button class="back" id="back-btn">‹</button>
        <h1 class="${flagClass}">${escapeHtml(park.name)}</h1>
        <div class="subtitle">${escapeHtml(park.region || '')}${dist != null ? ` · ${dist.toFixed(1)} km entfernt` : ''}</div>
        <div class="tags">
          ${openBadge}
          ${(park.tags || []).map((t) => `<span class="badge">${tagLabel(t)}</span>`).join('')}
          ${park.isCustom ? '<span class="badge">eigener Park</span>' : ''}
        </div>
      </div>

      <div class="detail-section">
        <div class="action-row">
          <a class="action-btn primary" id="route-btn" href="#"><span class="icon">🧭</span><span>Navigieren</span></a>
          <a class="action-btn" id="homepage-btn" href="${park.homepage || '#'}" target="_blank" rel="noopener"><span class="icon">🌐</span><span>Webseite</span></a>
          <button class="action-btn ${inBucket ? 'warn' : ''}" id="bucket-btn">
            <span class="icon">${inBucket ? '⭐' : '☆'}</span><span>${inBucket ? 'Wishlist ✓' : 'Auf Wishlist'}</span>
          </button>
          <button class="action-btn success" id="ridden-btn"><span class="icon">✅</span><span>Heute gefahren</span></button>
        </div>
      </div>

      <div class="detail-section">
        <h3>Eckdaten</h3>
        <div class="fact-grid">
          ${factsHtml(park)}
        </div>
        ${park.description ? `<p class="note" style="margin-top:10px;color:var(--text-2);font-style:normal">${escapeHtml(park.description)}</p>` : ''}
        ${park.season?.note ? `<p class="note">Saison: ${escapeHtml(park.season.note)}</p>` : ''}
      </div>

      ${(park.trails && park.trails.length) ? `
      <div class="detail-section">
        <h3>Strecken (${park.trails.length})</h3>
        <div class="trail-list">
          ${park.trails.map(trailHtml).join('')}
        </div>
      </div>` : ''}

      ${park.amenities?.length ? `
      <div class="detail-section">
        <h3>Ausstattung</h3>
        <div class="amenity-grid">
          ${park.amenities.map((a) => `
            <div class="amenity">
              <span class="ico">${store.AMENITY_ICONS[a] || '✓'}</span>
              ${store.AMENITY_LABELS[a] || a}
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="detail-section">
        <h3>Wetter</h3>
        <div id="weather-container"><span class="note">Lade Wetter…</span></div>
      </div>

      <div class="detail-section">
        <h3>Deine Bewertung</h3>
        <div class="rating-stars" id="rating-stars">
          ${[1,2,3,4,5].map((n) => `<button data-n="${n}" class="${visit.rating >= n ? 'active' : ''}">★</button>`).join('')}
        </div>
      </div>

      <div class="detail-section">
        <h3>Deine Notizen</h3>
        <textarea class="notes-area" id="notes" placeholder="Deine Notizen, Lieblingstrails, Tipps…">${escapeHtml(visit.notes || '')}</textarea>
        <button class="btn-secondary" id="save-notes" style="margin-top:8px">Notizen speichern</button>
      </div>

      <div class="detail-section">
        <h3>Fotos & Videos (${(await db.getMediaByPark(parkId)).length})</h3>
        <div class="media-grid" id="media-grid"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="file" id="media-input" accept="image/*,video/*" multiple capture="environment" hidden />
          <button class="btn-secondary" id="add-media">📷 Foto/Video hinzufügen</button>
        </div>
      </div>

      <div class="detail-section">
        <h3>Sessions / Tracks</h3>
        <div id="sessions-container">${sessionsHtml(visit, store.getTracksForPark(parkId))}</div>
        <input type="file" id="track-input" accept=".gpx,.fit" hidden />
        <button class="btn-secondary" id="add-track" style="margin-top:8px">📊 GPX / FIT importieren</button>
      </div>

      ${park.isCustom ? `
      <div class="detail-section">
        <button class="btn-danger" id="delete-park" style="width:100%">🗑️ Eigenen Park löschen</button>
      </div>` : ''}
    </div>
  `;

  bindHandlers(container, park, visit, parkId);
  loadWeather(container, park);
  loadMedia(container, parkId);
}

function factsHtml(park) {
  const e = park.elevation;
  const p = park.prices;
  const cur = p?.currency === 'CHF' ? 'CHF' : '€';
  const items = [];
  if (e) items.push({ label: 'Höhenunterschied', value: e.vertical ? `${e.vertical} hm` : '–', sub: e.base && e.top ? `${e.base}–${e.top} m` : '' });
  if (park.trailKm) items.push({ label: 'Trailkilometer', value: `${park.trailKm} km`, sub: park.trailCount ? `${park.trailCount} Strecken` : '' });
  if (p?.dayPass != null) items.push({ label: 'Tagespass', value: p.dayPass === 0 ? 'gratis' : `${cur === '€' ? '€ ' : 'CHF '}${p.dayPass}`, sub: p.halfDay != null ? `½ Tag: ${cur === '€' ? '€ ' : 'CHF '}${p.halfDay}` : '' });
  if (p?.weekly) items.push({ label: 'Wochenpass', value: `${cur === '€' ? '€ ' : 'CHF '}${p.weekly}`, sub: p.season ? `Saison: ${cur === '€' ? '€ ' : 'CHF '}${p.season}` : '' });
  if (park.lift?.length) items.push({ label: 'Lifte', value: park.lift.map((l) => store.LIFT_LABELS[l] || l).slice(0, 2).join(', '), sub: '' });
  if (park.bikeTypes?.length) items.push({ label: 'Bike-Typen', value: park.bikeTypes.map((t) => store.BIKE_TYPE_LABELS[t] || t).slice(0, 3).join(', '), sub: park.bikeTypes.length > 3 ? `+${park.bikeTypes.length - 3} weitere` : '' });
  return items.map((i) => `
    <div class="fact">
      <div class="label">${escapeHtml(i.label)}</div>
      <div class="value">${escapeHtml(i.value)}${i.sub ? ` <small>${escapeHtml(i.sub)}</small>` : ''}</div>
    </div>
  `).join('');
}

function trailHtml(t) {
  const len = t.length_m ? (t.length_m >= 1000 ? `${(t.length_m / 1000).toFixed(1)} km` : `${t.length_m} m`) : '';
  return `
    <div class="trail">
      <span class="difficulty-dot ${t.difficulty || 'blue'}"></span>
      <div class="name">${escapeHtml(t.name)}${t.note ? ` <small style="color:var(--text-2)">· ${escapeHtml(t.note)}</small>` : ''}</div>
      <span class="meta">${[len, t.type ? trailTypeLabel(t.type) : ''].filter(Boolean).join(' · ')}</span>
    </div>
  `;
}
function trailTypeLabel(t) {
  return ({ downhill: 'DH', flow: 'Flow', enduro: 'Enduro', xc: 'XC', freeride: 'FR', skill: 'Skill', pump: 'Pumptrack', dirt: 'Dirt', tour: 'Tour', slopestyle: 'Slope', fourx: '4X' })[t] || t;
}
function tagLabel(t) {
  return ({
    worldcup: '🏆 World Cup', epic: '⭐ Epic', uci: 'UCI', destination: '🎯 Destination',
    longtrail: '📏 Lange Trails', bigmountain: '⛰ Big Mountain', longseason: '📅 Lange Saison',
    citynear: '🏙 stadtnah', munichnear: '🏙 nahe München', family: '👨‍👩‍👧 Familie',
    expert: '💀 Expert', extreme: '☠️ Extrem', altitude: '🏔 Höhenlage',
    enduro: '🥾 Enduro', dolomiti: '🏔 Dolomiten', alpine: '🏔 alpin', panorama: '📸 Panorama',
    free: '🆓 kostenlos', club: '🤝 Verein', shuttle: '🚐 Shuttle', glacier: '❄️ Gletscher',
    unesco: '🌍 UNESCO', international: '🌐 international', lake: '🌊 See', xc: '🏃 XC',
    affordable: '💰 günstig',
  })[t] || t;
}

async function loadWeather(container, park) {
  const el = container.querySelector('#weather-container');
  try {
    const w = await getWeather(park.lat, park.lon);
    const days = w.daily.time.map((t, i) => ({
      date: t,
      code: w.daily.weather_code[i],
      tmax: Math.round(w.daily.temperature_2m_max[i]),
      tmin: Math.round(w.daily.temperature_2m_min[i]),
      precip: w.daily.precipitation_sum[i],
      wind: Math.round(w.daily.wind_speed_10m_max[i]),
    }));
    const cur = w.current;
    el.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
        <span style="font-size:36px">${weatherIcon(cur.weather_code, cur.is_day)}</span>
        <div>
          <div style="font-size:22px;font-weight:600">${Math.round(cur.temperature_2m)}°C</div>
          <div style="color:var(--text-2);font-size:12px">Wind ${Math.round(cur.wind_speed_10m)} km/h · jetzt</div>
        </div>
      </div>
      <div class="weather-grid">
        ${days.slice(0, 4).map((d) => `
          <div class="weather-day">
            <div class="day">${dayLabel(d.date)}</div>
            <div class="ico">${weatherIcon(d.code, 1)}</div>
            <div class="temp">${d.tmax}° <small>/${d.tmin}°</small></div>
            ${d.precip > 0.5 ? `<div class="day" style="color:#63b3ed">💧 ${d.precip.toFixed(1)} mm</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    el.innerHTML = '<span class="note">Wetter konnte nicht geladen werden.</span>';
  }
}

async function loadMedia(container, parkId) {
  const grid = container.querySelector('#media-grid');
  const items = await db.getMediaByPark(parkId);
  if (items.length === 0) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = items.map((m) => `
    <div class="media-item" data-id="${m.id}">
      ${m.type === 'video'
        ? `<video src="${URL.createObjectURL(m.blob)}" muted playsinline preload="metadata"></video><div class="video-badge">🎬</div>`
        : `<img src="${URL.createObjectURL(m.blob)}" />`}
      <button class="del" data-id="${m.id}">×</button>
    </div>
  `).join('');
  grid.querySelectorAll('.del').forEach((b) => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Medium löschen?')) return;
      await db.deleteMedia(b.dataset.id);
      await loadMedia(container, parkId);
      showToast('Gelöscht');
    });
  });
  grid.querySelectorAll('.media-item').forEach((it) => {
    it.addEventListener('click', () => {
      const id = it.dataset.id;
      const m = items.find((x) => x.id === id);
      if (!m) return;
      const url = URL.createObjectURL(m.blob);
      const w = window.open(url, '_blank');
      if (!w) showToast('Vollbild blockiert', 'warn');
    });
  });
}

function sessionsHtml(visit, tracks) {
  const sessions = visit.sessions || [];
  const orphanTracks = (tracks || []).filter((t) => !sessions.some((s) => s.trackId === t.id));
  if (sessions.length === 0 && orphanTracks.length === 0) {
    return '<p class="note">Noch keine Sessions. Tippe auf "Heute gefahren" oder importiere einen GPX/FIT-Track.</p>';
  }
  let html = '';
  for (const s of sessions) {
    const stats = s.stats || {};
    html += `
      <div class="session" data-session="${s.id}">
        <div class="session-head">
          <span class="date">${formatDate(s.date)}</span>
          <button class="del-session" data-id="${s.id}" style="color:var(--danger);font-size:12px">Löschen</button>
        </div>
        <div class="session-stats">
          ${stats.distance_m ? `<span>📏 ${(stats.distance_m / 1000).toFixed(1)} km</span>` : ''}
          ${stats.descent_m ? `<span>⬇️ ${stats.descent_m} hm</span>` : ''}
          ${stats.ascent_m ? `<span>⬆️ ${stats.ascent_m} hm</span>` : ''}
          ${stats.maxSpeed_kmh ? `<span>⚡ ${stats.maxSpeed_kmh} km/h</span>` : ''}
          ${stats.movingTime_s ? `<span>⏱ ${formatDuration(stats.movingTime_s)}</span>` : ''}
        </div>
        ${s.trackId ? `<button class="btn-secondary" data-track="${s.trackId}" style="margin-top:8px;font-size:13px">GPX exportieren</button>` : ''}
      </div>
    `;
  }
  for (const t of orphanTracks) {
    html += `
      <div class="session">
        <div class="session-head">
          <span class="date">📊 ${escapeHtml(t.name || 'Track')} (nicht zugeordnet)</span>
        </div>
        <div class="session-stats">
          ${t.stats?.distance_m ? `<span>📏 ${(t.stats.distance_m / 1000).toFixed(1)} km</span>` : ''}
          ${t.stats?.descent_m ? `<span>⬇️ ${t.stats.descent_m} hm</span>` : ''}
        </div>
      </div>
    `;
  }
  return html;
}

function bindHandlers(container, park, visit, parkId) {
  container.querySelector('#back-btn').addEventListener('click', () => {
    store.setView('map');
  });

  // Routing
  container.querySelector('#route-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const url = isApple
      ? `https://maps.apple.com/?daddr=${park.lat},${park.lon}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lon}&travelmode=driving`;
    window.open(url, '_blank');
  });

  // Bucket
  container.querySelector('#bucket-btn').addEventListener('click', async () => {
    if (store.isInBucket(parkId)) {
      await db.removeFromBucket(parkId);
      showToast('Von Wishlist entfernt');
    } else {
      await db.addToBucket(parkId);
      showToast('Zur Wishlist hinzugefügt ⭐');
    }
    await store.refreshUserData();
  });

  // Mark as ridden today
  container.querySelector('#ridden-btn').addEventListener('click', async () => {
    const session = await db.addSession(parkId, { date: new Date().toISOString().slice(0, 10), source: 'manual' });
    showToast(`Als gefahren markiert ✅`);
    await store.refreshUserData();
  });

  // Rating
  for (const b of container.querySelectorAll('#rating-stars button')) {
    b.addEventListener('click', async () => {
      const n = parseInt(b.dataset.n, 10);
      const cur = store.getVisit(parkId)?.rating || 0;
      const newRating = n === cur ? 0 : n;
      await db.setRating(parkId, newRating);
      showToast(newRating > 0 ? `Bewertung: ${newRating}★` : 'Bewertung entfernt');
      await store.refreshUserData();
    });
  }

  // Notes
  container.querySelector('#save-notes').addEventListener('click', async () => {
    const text = container.querySelector('#notes').value;
    await db.setNotes(parkId, text);
    showToast('Notizen gespeichert');
    await store.refreshUserData();
  });

  // Media
  const mediaInput = container.querySelector('#media-input');
  container.querySelector('#add-media').addEventListener('click', () => mediaInput.click());
  mediaInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const type = f.type.startsWith('video/') ? 'video' : 'image';
      try {
        await db.addMedia({ parkId, type, blob: f });
      } catch (err) {
        showToast(`Fehler beim Speichern: ${err.message}`, 'error');
      }
    }
    if (files.length) showToast(`${files.length} Datei(en) gespeichert`);
    mediaInput.value = '';
    loadMedia(container, parkId);
  });

  // Tracks
  const trackInput = container.querySelector('#track-input');
  container.querySelector('#add-track').addEventListener('click', () => trackInput.click());
  trackInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Lese Track…');
      const track = await parseTrackFile(file);
      track.parkId = parkId;
      track.attachedToSession = true;
      const saved = await db.addTrack(track);
      await db.addSession(parkId, {
        date: track.points[0]?.time ? new Date(track.points[0].time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        source: track.source,
        trackId: saved.id,
        stats: track.stats,
      });
      showToast(`Track importiert: ${(track.stats.distance_m / 1000).toFixed(1)} km, ${track.stats.descent_m} hm`);
      await store.refreshUserData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      trackInput.value = '';
    }
  });

  // Delete sessions
  for (const b of container.querySelectorAll('.del-session')) {
    b.addEventListener('click', async () => {
      if (!confirm('Session löschen?')) return;
      await db.deleteSession(parkId, b.dataset.id);
      showToast('Session gelöscht');
      await store.refreshUserData();
    });
  }

  // Export GPX
  for (const b of container.querySelectorAll('[data-track]')) {
    b.addEventListener('click', async () => {
      const tracks = await db.getTracksByPark(parkId);
      const t = tracks.find((x) => x.id === b.dataset.track);
      if (!t) return;
      const gpx = trackToGPX(t);
      const blob = new Blob([gpx], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(t.name || 'track').replace(/[^\w\d-]/g, '_')}.gpx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  // Delete custom park
  const delBtn = container.querySelector('#delete-park');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm(`"${park.name}" wirklich löschen?`)) return;
      await db.deleteCustomPark(parkId);
      await db.deleteVisit(parkId);
      // Re-init store to drop the custom park
      await store.init();
      store.setView('list');
      showToast('Park gelöscht');
    });
  }
}

function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
