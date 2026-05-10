import * as store from '../lib/store.js';

export function renderStats(container) {
  const s = store.aggregateStats();
  const total = (s.byCountry.DE || 0) + (s.byCountry.AT || 0) + (s.byCountry.CH || 0) + (s.byCountry.IT || 0) + (s.byCountry.OTHER || 0);
  const max = Math.max(1, ...Object.values(s.byCountry));

  container.innerHTML = `
    <div class="stats-wrap">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="ico">🚵</div>
          <div class="num">${s.parksVisited}</div>
          <div class="lbl">Parks gefahren</div>
        </div>
        <div class="kpi">
          <div class="ico">🎫</div>
          <div class="num">${s.totalSessions}</div>
          <div class="lbl">Sessions gesamt</div>
        </div>
        <div class="kpi">
          <div class="ico">📏</div>
          <div class="num">${s.totalKm}</div>
          <div class="lbl">km gefahren</div>
        </div>
        <div class="kpi">
          <div class="ico">⬇️</div>
          <div class="num">${formatHm(s.totalDescent)}</div>
          <div class="lbl">Tiefenmeter</div>
        </div>
        <div class="kpi">
          <div class="ico">⏱</div>
          <div class="num">${s.totalTimeHours}</div>
          <div class="lbl">Stunden Fahrzeit</div>
        </div>
        <div class="kpi">
          <div class="ico">🌍</div>
          <div class="num">${s.countriesVisited}/4</div>
          <div class="lbl">Länder</div>
        </div>
        <div class="kpi">
          <div class="ico">⭐</div>
          <div class="num">${s.bucketCount}</div>
          <div class="lbl">auf Wishlist</div>
        </div>
        <div class="kpi">
          <div class="ico">${s.avgRating > 0 ? '★' : '☆'}</div>
          <div class="num">${s.avgRating > 0 ? s.avgRating.toFixed(1) : '–'}</div>
          <div class="lbl">⌀ Bewertung</div>
        </div>
      </div>

      <h3 style="margin:20px 0 10px;font-size:13px;text-transform:uppercase;color:var(--text-2);letter-spacing:0.5px">Parks pro Land</h3>
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

      <h3 style="margin:20px 0 10px;font-size:13px;text-transform:uppercase;color:var(--text-2);letter-spacing:0.5px">Insgesamt verfügbar</h3>
      <p style="color:var(--text-2);font-size:13px">In der App sind aktuell <b>${s.parksTotal}</b> Bikeparks erfasst – davon hast du <b>${s.parksVisited}</b> (${total ? Math.round(s.parksVisited / s.parksTotal * 100) : 0}%) gefahren.</p>

      ${renderTopTags(s.tagsCount)}

      <div style="margin-top:30px">
        <p class="note">Datengrundlage: kuratierte Parks + deine eigenen. Preise & Saison Stand 2024 – aktuelle Infos auf der jeweiligen Webseite checken.</p>
      </div>
    </div>
  `;
}

function renderTopTags(tagsCount) {
  const top = Object.entries(tagsCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) return '';
  return `
    <h3 style="margin:20px 0 10px;font-size:13px;text-transform:uppercase;color:var(--text-2);letter-spacing:0.5px">Deine Lieblings-Tags</h3>
    <div class="chip-group">
      ${top.map(([t, n]) => `<span class="chip active">${tagToLabel(t)} · ${n}</span>`).join('')}
    </div>
  `;
}
function tagToLabel(t) {
  return ({
    worldcup: '🏆 World Cup', epic: '⭐ Epic', destination: '🎯 Destination',
    bigmountain: '⛰ Big Mountain', longtrail: '📏 Lange Trails',
    family: '👨‍👩‍👧 Familie', alpine: '🏔 alpin', dolomiti: '🏔 Dolomiten',
    enduro: '🥾 Enduro', citynear: '🏙 stadtnah', longseason: '📅 lange Saison',
    free: '🆓 kostenlos', club: '🤝 Verein',
  })[t] || t;
}

function formatHm(m) {
  if (m >= 10000) return `${(m / 1000).toFixed(1)}k`;
  return String(m);
}
