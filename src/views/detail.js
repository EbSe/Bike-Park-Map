import * as store from '../lib/store.js';
import * as db from '../lib/db.js';
import { getWeather, weatherIcon, dayLabel } from '../lib/weather.js';
import { parseTrackFile, formatDuration, trackToGPX } from '../lib/gpx.js';
import { tileUrl } from '../lib/map-tile.js';
import { icon } from '../lib/icons.js';
import { showToast } from './toast.js';

export async function renderDetail(container, parkId) {
  const park = store.getPark(parkId);
  if (!park) {
    container.innerHTML = `<div class="empty"><div class="emoji">❓</div><div class="title">Park nicht gefunden</div></div>`;
    return;
  }
  const visit = store.getVisit(parkId) || { parkId, sessions: [], rating: 0, notes: '' };
  const inBucket = store.isInBucket(parkId);
  const sessions = visit.sessions || [];
  const visited = sessions.length > 0;
  const dist = store.distanceTo(park);
  const flag = store.COUNTRY_FLAGS[park.country] || '📍';
  const open = store.isParkOpenToday(park);
  const openBadge = open === true ? '<span class="chip active" style="background:linear-gradient(135deg,#4ade80,#16a34a);color:#052e16">🟢 Geöffnet</span>'
    : open === false ? '<span class="chip" style="color:#fbbf24;border-color:rgba(251,191,36,0.4);background:rgba(251,191,36,0.1)">🟠 Außerhalb Saison</span>'
    : '';

  const media = await db.getMediaByPark(parkId);

  const heroTile = tileUrl(park.lat, park.lon, 12, 'dark');

  container.innerHTML = `
    <div class="detail-wrap">
      <div class="detail-hero">
        <img class="detail-hero-bg" src="${heroTile}" alt="" />
        <div class="detail-hero-veil"></div>
        <button class="detail-back" id="back-btn" aria-label="Zurück">‹</button>
        <div class="detail-hero-content">
          <div class="detail-hero-flag">${flag}</div>
          <h1>${escapeHtml(park.name)}</h1>
          <div class="subtitle">${escapeHtml(park.region || '')}${dist != null ? ` · ${dist.toFixed(1)} km entfernt` : ''}</div>
          <div class="hero-tags">
            ${openBadge}
            ${(park.tags || []).slice(0, 4).map((t) => `<span class="chip">${tagLabel(t)}</span>`).join('')}
            ${park.isCustom ? '<span class="chip" style="background:rgba(192,132,252,0.18);color:#c084fc">eigener Park</span>' : ''}
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-actions">
          <a class="action-btn" id="route-btn" href="#">
            ${icon('navigate', 22)}<span>Routen</span>
          </a>
          <a class="action-btn" id="homepage-btn" href="${park.homepage || '#'}" target="_blank" rel="noopener">
            ${icon('globe', 22)}<span>Webseite</span>
          </a>
          <button class="action-btn ${inBucket ? 'is-on-warn' : ''}" id="bucket-btn">
            ${icon(inBucket ? 'starFilled' : 'star', 22)}<span>${inBucket ? 'Gemerkt' : 'Merken'}</span>
          </button>
          <button class="action-btn ${visited ? 'is-on' : ''}" id="ridden-btn">
            ${icon('check', 22)}<span>${visited ? `${sessions.length}× hier` : 'Heute hier'}</span>
          </button>
        </div>
      </div>

      <div class="detail-section">
        <h3>Eckdaten</h3>
        <div class="fact-grid">
          ${factsHtml(park)}
        </div>
        ${park.description ? `<p class="description" style="margin-top:14px">${escapeHtml(park.description)}</p>` : ''}
        ${park.season?.note ? `<p class="description muted" style="margin-top:8px">📅 ${escapeHtml(park.season.note)}</p>` : ''}
        ${park.lastVerified ? `<p class="description muted" style="margin-top:4px;font-size:11px">Daten Stand ${escapeHtml(park.lastVerified)} – Preise und Saisonzeiten bitte auf der Webseite verifizieren.</p>` : ''}
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
        <div id="weather-container">
          <div class="weather-current skeleton" style="height:92px"></div>
          <div class="weather-grid" style="margin-top:14px">
            ${[0,1,2,3].map(() => '<div class="skeleton" style="height:82px;border-radius:12px"></div>').join('')}
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Deine Bewertung</h3>
        <div class="rating-stars" id="rating-stars">
          ${[1,2,3,4,5].map((n) => `<button data-n="${n}" class="${visit.rating >= n ? 'active' : ''}">★</button>`).join('')}
        </div>
      </div>

      <div class="detail-section">
        <h3>Deine Notizen</h3>
        <textarea class="notes-area" id="notes" placeholder="Lieblingstrails, Tipps, Geheimnisse…">${escapeHtml(visit.notes || '')}</textarea>
        <button class="btn btn-secondary" id="save-notes" style="margin-top:10px">Notizen speichern</button>
      </div>

      <div class="detail-section">
        <h3>Fotos & Videos <span style="color:var(--text-3);text-transform:none;letter-spacing:0">(${media.length})</span></h3>
        <div class="media-grid" id="media-grid"></div>
        <input type="file" id="media-input" accept="image/*,video/*" multiple capture="environment" hidden />
        <button class="btn btn-secondary" id="add-media" style="margin-top:10px">📷 Foto oder Video hinzufügen</button>
      </div>

      <div class="detail-section">
        <h3>Sessions & Tracks</h3>
        <div id="sessions-container">${sessionsHtml(visit, store.getTracksForPark(parkId))}</div>
        <input type="file" id="track-input" accept=".gpx,.fit" hidden />
        <button class="btn btn-secondary" id="add-track" style="margin-top:10px">📊 GPX / FIT importieren</button>
      </div>

      ${!park.isCustom ? `
      <div class="detail-section">
        <h3>Daten</h3>
        <a class="btn btn-secondary" id="report-btn" href="${reportUrl(park)}" target="_blank" rel="noopener">📝 Veraltete Daten melden</a>
        <p class="description muted" style="margin-top:10px;font-size:12px">Öffnet ein GitHub-Issue mit vorausgefüllter Vorlage. Datenpflege ist Community-getrieben.</p>
      </div>` : ''}

      ${park.isCustom ? `
      <div class="detail-section">
        <button class="btn btn-danger" id="delete-park">🗑️ Eigenen Park löschen</button>
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
  const cur = p?.currency === 'CHF' ? 'CHF ' : '€ ';
  const items = [];
  if (e) items.push({ ico: '⛰', label: 'Höhenunterschied', value: e.vertical ? `${e.vertical}` : '–', unit: 'hm', sub: e.base && e.top ? `${e.base}–${e.top} m` : '' });
  if (park.trailKm) items.push({ ico: '🛤', label: 'Trailkilometer', value: `${park.trailKm}`, unit: 'km', sub: park.trailCount ? `${park.trailCount} Strecken` : '' });
  if (p?.dayPass != null) items.push({ ico: '🎫', label: 'Tagespass', value: p.dayPass === 0 ? 'gratis' : `${cur.trim()} ${p.dayPass}`, sub: p.halfDay != null && p.dayPass !== 0 ? `½ Tag ${cur}${p.halfDay}` : (p.weekly ? `Woche ${cur}${p.weekly}` : '') });
  if (park.lift?.length) items.push({ ico: '🚠', label: 'Liftart', value: liftSummary(park.lift), sub: '' });
  if (park.bikeTypes?.length) items.push({ ico: '🚲', label: 'Bike-Typen', value: park.bikeTypes.slice(0, 2).map((t) => store.BIKE_TYPE_LABELS[t] || t).join(' · '), sub: park.bikeTypes.length > 2 ? `+${park.bikeTypes.length - 2} weitere` : '' });
  if (p?.season) items.push({ ico: '🎟', label: 'Saisonpass', value: `${cur}${p.season}`, sub: '' });
  return items.map((i) => `
    <div class="fact">
      <div class="ico">${i.ico}</div>
      <div class="label">${escapeHtml(i.label)}</div>
      <div class="value">${escapeHtml(i.value)}${i.unit ? ` <small style="font-size:13px;color:var(--text-2);font-weight:500;display:inline">${i.unit}</small>` : ''}${i.sub ? `<small>${escapeHtml(i.sub)}</small>` : ''}</div>
    </div>
  `).join('');
}

function liftSummary(lifts) {
  if (!lifts || lifts.length === 0) return '–';
  if (lifts.includes('none')) return 'Kein Lift';
  if (lifts.includes('gondola')) return 'Gondelbahn';
  if (lifts.includes('chairlift')) return 'Sessellift';
  if (lifts.includes('cablecar')) return 'Seilbahn';
  if (lifts.includes('funicular')) return 'Standseilbahn';
  return store.LIFT_LABELS[lifts[0]] || lifts[0];
}

function trailHtml(t) {
  const len = t.length_m ? (t.length_m >= 1000 ? `${(t.length_m / 1000).toFixed(1)} km` : `${t.length_m} m`) : '';
  return `
    <div class="trail">
      <span class="difficulty-marker ${t.difficulty || 'blue'}"></span>
      <div class="name">${escapeHtml(t.name)}${t.note ? `<small>${escapeHtml(t.note)}</small>` : ''}</div>
      <span class="trail-meta">${len ? `<strong>${len}</strong>` : ''}${t.type ? `<br>${trailTypeLabel(t.type)}` : ''}</span>
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
    citynear: '🏙 stadtnah', munichnear: '🏙 nahe München', family: '👨‍👩 Familie',
    expert: '💀 Expert', extreme: '☠️ Extrem', altitude: '🏔 Höhenlage',
    enduro: '🥾 Enduro', dolomiti: '🏔 Dolomiten', alpine: '🏔 alpin', panorama: '📸 Panorama',
    free: '🆓 kostenlos', club: '🤝 Verein', shuttle: '🚐 Shuttle', glacier: '❄️ Gletscher',
    unesco: '🌍 UNESCO', international: '🌐 international', lake: '🌊 See', xc: '🏃 XC',
    affordable: '💰 günstig', custom: '✏ eigen',
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
      <div class="weather-current">
        <div class="ico">${weatherIcon(cur.weather_code, cur.is_day)}</div>
        <div class="meta">
          <div class="label">Aktuell</div>
          <div class="row">Wind ${Math.round(cur.wind_speed_10m)} km/h</div>
        </div>
        <div class="big-temp">${Math.round(cur.temperature_2m)}°</div>
      </div>
      <div class="weather-grid">
        ${days.slice(0, 4).map((d) => `
          <div class="weather-day">
            <div class="day">${dayLabel(d.date)}</div>
            <div class="ico">${weatherIcon(d.code, 1)}</div>
            <div class="temp">${d.tmax}° <small>/ ${d.tmin}°</small></div>
            ${d.precip > 0.5 ? `<div class="precip">💧 ${d.precip.toFixed(1)} mm</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    el.innerHTML = '<div class="notice">Wetter konnte gerade nicht geladen werden. Funktioniert online.</div>';
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
        ? `<video src="${URL.createObjectURL(m.blob)}" muted playsinline preload="metadata"></video><div class="video-badge">▶</div>`
        : `<img src="${URL.createObjectURL(m.blob)}" alt="" />`}
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
      window.open(url, '_blank');
    });
  });
}

function sessionsHtml(visit, tracks) {
  const sessions = visit.sessions || [];
  const orphanTracks = (tracks || []).filter((t) => !sessions.some((s) => s.trackId === t.id));
  if (sessions.length === 0 && orphanTracks.length === 0) {
    return '<div class="empty" style="padding:24px"><div class="emoji">📊</div><div class="title">Noch keine Sessions</div><div class="sub">Tippe "Heute hier" oder importiere einen GPX/FIT-Track.</div></div>';
  }
  let html = '';
  for (const s of sessions) {
    const stats = s.stats || {};
    html += `
      <div class="session" data-session="${s.id}">
        <div class="session-head">
          <span class="date">${formatDate(s.date)}</span>
          <button class="del-session" data-id="${s.id}">Löschen</button>
        </div>
        <div class="session-stats">
          ${stats.distance_m ? `<span>📏 <strong>${(stats.distance_m / 1000).toFixed(1)}</strong> km</span>` : ''}
          ${stats.descent_m ? `<span>⬇️ <strong>${stats.descent_m}</strong> hm</span>` : ''}
          ${stats.ascent_m ? `<span>⬆️ <strong>${stats.ascent_m}</strong> hm</span>` : ''}
          ${stats.maxSpeed_kmh ? `<span>⚡ <strong>${stats.maxSpeed_kmh}</strong> km/h</span>` : ''}
          ${stats.movingTime_s ? `<span>⏱ <strong>${formatDuration(stats.movingTime_s)}</strong></span>` : ''}
        </div>
        ${s.trackId ? `<button class="btn btn-secondary" data-track="${s.trackId}" style="margin-top:6px;font-size:13px;padding:10px">GPX exportieren</button>` : ''}
      </div>
    `;
  }
  for (const t of orphanTracks) {
    html += `
      <div class="session">
        <div class="session-head">
          <span class="date">📊 ${escapeHtml(t.name || 'Track')}</span>
          <span style="color:var(--text-3);font-size:12px">orphan</span>
        </div>
        <div class="session-stats">
          ${t.stats?.distance_m ? `<span>📏 <strong>${(t.stats.distance_m / 1000).toFixed(1)}</strong> km</span>` : ''}
          ${t.stats?.descent_m ? `<span>⬇️ <strong>${t.stats.descent_m}</strong> hm</span>` : ''}
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

  container.querySelector('#route-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const url = isApple
      ? `https://maps.apple.com/?daddr=${park.lat},${park.lon}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lon}&travelmode=driving`;
    window.open(url, '_blank');
  });

  container.querySelector('#bucket-btn').addEventListener('click', async () => {
    if (store.isInBucket(parkId)) {
      await db.removeFromBucket(parkId);
      showToast('Von Wishlist entfernt');
    } else {
      await db.addToBucket(parkId);
      showToast('Auf Wishlist gemerkt', 'success');
    }
    await store.refreshUserData();
  });

  container.querySelector('#ridden-btn').addEventListener('click', async () => {
    await db.addSession(parkId, { date: new Date().toISOString().slice(0, 10), source: 'manual' });
    showToast('Als gefahren markiert', 'success');
    await store.refreshUserData();
  });

  for (const b of container.querySelectorAll('#rating-stars button')) {
    b.addEventListener('click', async () => {
      const n = parseInt(b.dataset.n, 10);
      const cur = store.getVisit(parkId)?.rating || 0;
      const newRating = n === cur ? 0 : n;
      await db.setRating(parkId, newRating);
      showToast(newRating > 0 ? `Bewertung ${newRating}★` : 'Bewertung entfernt');
      await store.refreshUserData();
    });
  }

  container.querySelector('#save-notes').addEventListener('click', async () => {
    const text = container.querySelector('#notes').value;
    await db.setNotes(parkId, text);
    showToast('Notizen gespeichert', 'success');
    await store.refreshUserData();
  });

  const mediaInput = container.querySelector('#media-input');
  container.querySelector('#add-media').addEventListener('click', () => mediaInput.click());
  mediaInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const type = f.type.startsWith('video/') ? 'video' : 'image';
      try {
        await db.addMedia({ parkId, type, blob: f });
      } catch (err) {
        showToast(`Fehler: ${err.message}`, 'error');
      }
    }
    if (files.length) showToast(`${files.length} hinzugefügt`, 'success');
    mediaInput.value = '';
    loadMedia(container, parkId);
  });

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
      showToast(`Track importiert: ${(track.stats.distance_m / 1000).toFixed(1)} km`, 'success');
      await store.refreshUserData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      trackInput.value = '';
    }
  });

  for (const b of container.querySelectorAll('.del-session')) {
    b.addEventListener('click', async () => {
      if (!confirm('Session löschen?')) return;
      await db.deleteSession(parkId, b.dataset.id);
      showToast('Session gelöscht');
      await store.refreshUserData();
    });
  }

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

  const delBtn = container.querySelector('#delete-park');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm(`"${park.name}" wirklich löschen?`)) return;
      await db.deleteCustomPark(parkId);
      await db.deleteVisit(parkId);
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

function reportUrl(park) {
  const repo = 'EbSe/Bike-Park-Map';
  const title = encodeURIComponent(`Datenupdate: ${park.name}`);
  const body = encodeURIComponent(
    `**Park:** ${park.name} (id: ${park.id})\n` +
    `**Webseite:** ${park.homepage || '–'}\n\n` +
    `### Was ist veraltet?\n\n- [ ] Preise\n- [ ] Saisonzeiten\n- [ ] Trails / Schwierigkeiten\n- [ ] Lifte\n- [ ] Sonstiges\n\n` +
    `### Vorschlag\n\n_Bitte beschreibe was sich geändert hat, idealerweise mit Quelle (z.B. Link zur Park-Webseite)._\n`
  );
  return `https://github.com/${repo}/issues/new?title=${title}&body=${body}&labels=data-update`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
