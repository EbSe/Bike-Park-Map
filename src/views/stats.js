import * as store from '../lib/store.js';

export function renderStats(container) {
  const s = store.aggregateStats();
  const max = Math.max(1, ...Object.values(s.byCountry));
  const progressPct = s.parksTotal > 0 ? Math.min(100, (s.parksVisited / s.parksTotal) * 100) : 0;

  container.innerHTML = `
    <div class="stats-wrap">
      <div class="stats-hero">
        <div class="big-num">${s.parksVisited}<small> / ${s.parksTotal}</small></div>
        <div class="lbl">Bikeparks gefahren · ${Math.round(progressPct)}% Sammlung</div>
        <div class="progress"><span style="width:${progressPct}%"></span></div>
      </div>

      <div class="kpi-grid">
        <div class="kpi">
          <div class="ico">🎫</div>
          <div class="num">${s.totalSessions}</div>
          <div class="lbl">Sessions</div>
        </div>
        <div class="kpi">
          <div class="ico">📏</div>
          <div class="num">${s.totalKm}<small> km</small></div>
          <div class="lbl">gefahren</div>
        </div>
        <div class="kpi">
          <div class="ico">⬇️</div>
          <div class="num">${formatHm(s.totalDescent)}</div>
          <div class="lbl">Tiefenmeter</div>
        </div>
        <div class="kpi">
          <div class="ico">⏱</div>
          <div class="num">${s.totalTimeHours}<small> h</small></div>
          <div class="lbl">Fahrzeit</div>
        </div>
        <div class="kpi">
          <div class="ico">🌍</div>
          <div class="num">${s.countriesVisited}<small> / 4</small></div>
          <div class="lbl">Länder</div>
        </div>
        <div class="kpi">
          <div class="ico">⭐</div>
          <div class="num">${s.bucketCount}</div>
          <div class="lbl">Wishlist</div>
        </div>
        <div class="kpi">
          <div class="ico">⬆️</div>
          <div class="num">${formatHm(s.totalAscent)}</div>
          <div class="lbl">Höhenmeter ↑</div>
        </div>
        <div class="kpi">
          <div class="ico">${s.avgRating > 0 ? '★' : '☆'}</div>
          <div class="num">${s.avgRating > 0 ? s.avgRating.toFixed(1) : '–'}</div>
          <div class="lbl">⌀ Bewertung</div>
        </div>
      </div>

      <div class="stat-section-title">Parks pro Land</div>
      <div class="country-bars">
        ${['DE','AT','CH','IT'].map((c) => `
          <div class="country-bar">
            <span class="flag">${store.COUNTRY_FLAGS[c]}</span>
            <span class="label">${c}</span>
            <div class="bar"><span style="width:${(s.byCountry[c] || 0) / max * 100}%"></span></div>
            <span class="num">${s.byCountry[c] || 0}</span>
          </div>
        `).join('')}
      </div>

      ${renderTopTags(s.tagsCount)}

      <div class="notice" style="margin-top:20px">
        <strong>Datenstand 2024.</strong> Preise und Saisonzeiten ändern sich jährlich – aktuelle Infos auf der jeweiligen Park-Webseite checken. Datenbank: 84 Parks im 400-km-Radius um Ravensburg.
      </div>
    </div>
  `;
}

function renderTopTags(tagsCount) {
  const top = Object.entries(tagsCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) return '';
  return `
    <div class="stat-section-title">Deine Lieblings-Themen</div>
    <div class="chip-group" style="padding:14px;background:var(--surface-1);border:1px solid var(--glass-border);border-radius:var(--r-lg)">
      ${top.map(([t, n]) => `<span class="chip active">${tagToLabel(t)} · ${n}</span>`).join('')}
    </div>
  `;
}
function tagToLabel(t) {
  return ({
    worldcup: '🏆 World Cup', epic: '⭐ Epic', destination: '🎯 Destination',
    bigmountain: '⛰ Big Mountain', longtrail: '📏 Lange Trails',
    family: '👨‍👩 Familie', alpine: '🏔 alpin', dolomiti: '🏔 Dolomiten',
    enduro: '🥾 Enduro', citynear: '🏙 stadtnah', longseason: '📅 lange Saison',
    free: '🆓 kostenlos', club: '🤝 Verein',
  })[t] || t;
}

function formatHm(m) {
  if (m >= 10000) return `${(m / 1000).toFixed(1)}k`;
  return String(m);
}
