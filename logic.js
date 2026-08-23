// Reine Domänen- und Optimierungslogik für den Ticket-Planer Saalbach Hinterglemm.
// Keine DOM-Zugriffe, kein globaler Zustand — ausschließlich Funktionen auf Eingabewerten.
// Wird sowohl von index.html (als ES-Modul) als auch von logic.test.mjs (Node) importiert.

export const INTENSITY = Object.freeze({ OFF: 0, CHILL: 1, HALF: 2, FULL: 3, SPLIT: 4 });

// Reihenfolge des Tipp-Zyklus (FR-02) — SPLIT sitzt bewusst zwischen HALF und FULL: mehr
// Fahrten als ein reiner Halbtag (4h-Ticket + 2 Joker-Freifahrten am Nachmittag), aber kein
// ganzer Tag.
export const INTENSITY_SEQUENCE = [INTENSITY.OFF, INTENSITY.CHILL, INTENSITY.HALF, INTENSITY.SPLIT, INTENSITY.FULL];

export const INTENSITY_META = Object.freeze({
  [INTENSITY.OFF]: { label: 'Aus', short: '–', color: '#6b7280', trail: 'neutral' },
  [INTENSITY.CHILL]: { label: 'Chill', short: 'C', color: '#2563eb', trail: 'blau' },
  [INTENSITY.HALF]: { label: 'Halbtag', short: 'H', color: '#dc2626', trail: 'rot' },
  [INTENSITY.SPLIT]: { label: 'Halbtag+', short: 'H+', color: '#f59e0b', trail: 'orange' },
  [INTENSITY.FULL]: { label: 'Vollgas', short: 'V', color: '#111111', trail: 'schwarz' },
});

export function nextIntensity(value) {
  const i = INTENSITY_SEQUENCE.indexOf(value);
  return INTENSITY_SEQUENCE[(i + 1) % INTENSITY_SEQUENCE.length];
}

export const TARIFFS = ['adult', 'youth', 'child'];

export const TARIFF_LABEL = Object.freeze({ adult: 'Erwachsen', youth: 'Jugend', child: 'Kind' });

// days[L] = Preis für ein Mehrtagesticket über L aufeinanderfolgende Tage (L=1 -> Tagesticket).
// Index 0 ist ungenutzt (kein 0-Tage-Ticket).
export const DEFAULT_PRICES = Object.freeze({
  joker: {
    adult: { h4: 45.0, days: [null, 53.0, 98.0, 134.5, 166.5, 199.0, 227.0, 253.5, 276.5] },
    youth: { h4: 33.5, days: [null, 39.5, 73.5, 101.0, 125.0, 149.5, 170.0, 190.5, 207.0] },
    child: { h4: 22.5, days: [null, 26.5, 49.0, 67.0, 83.0, 99.5, 113.5, 127.0, 138.5] },
  },
  kassa: {
    adult: { h4: 56.0, days: [null, 66.0, 122.5, 168.0, 208.0, 249.0, 283.5, 317.0, 345.5] },
    youth: { h4: 42.0, days: [null, 49.5, 92.0, 126.0, 156.0, 187.0, 212.5, 238.0, 259.0] },
    child: { h4: 28.0, days: [null, 33.0, 61.5, 84.0, 104.0, 124.5, 142.0, 158.0, 173.0] },
  },
});

export const KEYCARD_DEPOSIT = 2.0;

export const DEFAULT_PERSONS = Object.freeze([
  { id: 'sebastian', name: 'Sebastian', short: 'SE', tariff: 'adult' },
  { id: 'jeannette', name: 'Jeannette', short: 'JE', tariff: 'adult' },
  { id: 'theo', name: 'Theo', short: 'TH', tariff: 'child' },
  { id: 'tom', name: 'Tom', short: 'TO', tariff: 'child' },
]);

export const DEFAULT_DAY_COUNT = 8;

export function clonePrices(prices = DEFAULT_PRICES) {
  return JSON.parse(JSON.stringify(prices));
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function priceForDays(priceTable, length) {
  const raw = priceTable && priceTable.days ? priceTable.days[length] : undefined;
  if (raw === undefined || raw === null) return null;
  return toFiniteNumber(raw);
}

function requirementFor(intensity) {
  if (intensity === INTENSITY.FULL) return 2;
  // Halbtag+ (SPLIT) braucht preislich dasselbe wie ein reiner Halbtag: mindestens ein
  // 4-Stunden-Ticket. Der Unterschied ist nur, was am Nachmittag zusätzlich genutzt wird
  // (2 Joker-Freifahrten statt Feierabend) — das beeinflusst die Kosten nicht, nur die
  // Freifahrten-Auswertung (siehe computeFreeRides).
  if (intensity === INTENSITY.HALF || intensity === INTENSITY.SPLIT) return 1;
  return 0;
}

/**
 * Exakte dynamische Programmierung über die Tagesachse (siehe Anforderungsspezifikation 5.2).
 * Kandidaten werden in fester Reihenfolge A, B, C, D mit striktem "<" geprüft, damit bei
 * Kostengleichheit immer die einfachere/kleinteiligere Option gewinnt (siehe Akzeptanztest T-06).
 *
 * @param {number[]} intensities - Intensitätsstufen je Tag (INTENSITY.*)
 * @param {{h4:number, days:number[]}} priceTable - Preise für einen Tarif/eine Preisquelle
 * @param {{priorDayRule?: boolean}} options
 */
export function optimizeSchedule(intensities, priceTable, options = {}) {
  const priorDayRule = Boolean(options.priorDayRule);
  const n = intensities.length;
  const req = intensities.map(requirementFor);
  const h4Price = toFiniteNumber(priceTable && priceTable.h4);

  const dp = new Array(n + 1).fill(Infinity);
  const choice = new Array(n + 1).fill(null);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    let best = Infinity;
    let bestChoice = null;

    // A) kein Bedarf an Tag i -> Tag überspringen
    if (req[i] === 0) {
      const cost = dp[i + 1];
      if (cost < best) {
        best = cost;
        bestChoice = { type: 'skip' };
      }
    }

    // B) Halbtag -> 4-Stunden-Ticket deckt genau Tag i
    if (req[i] === 1) {
      const cost = h4Price + dp[i + 1];
      if (cost < best) {
        best = cost;
        bestChoice = { type: 'h4' };
      }
    }

    // C) Bedarf an Tag i -> Mehrtagesblock beginnend an Tag i, Länge L
    if (req[i] > 0) {
      const maxL = n - i;
      for (let length = 1; length <= maxL; length++) {
        const price = priceForDays(priceTable, length);
        if (price === null) continue;
        const cost = price + dp[i + length];
        if (cost < best) {
          best = cost;
          bestChoice = { type: 'block', start: i, length };
        }
      }
    }

    // D) Vortagsregel: Block beginnend an Tag i+1 deckt zusätzlich den Halbtagsbedarf an Tag i ab
    if (priorDayRule && req[i] === 1) {
      const maxL = n - i - 1;
      for (let length = 1; length <= maxL; length++) {
        const price = priceForDays(priceTable, length);
        if (price === null) continue;
        const cost = price + dp[i + 1 + length];
        if (cost < best) {
          best = cost;
          bestChoice = { type: 'priorBlock', start: i + 1, length, absorbedDay: i };
        }
      }
    }

    dp[i] = best;
    choice[i] = bestChoice;
  }

  const tickets = [];
  const priorDayCovered = [];
  let i = 0;
  while (i < n) {
    const c = choice[i];
    if (!c || c.type === 'skip') {
      i += 1;
      continue;
    }
    if (c.type === 'h4') {
      tickets.push({ type: 'h4', startDay: i, endDay: i, price: h4Price });
      i += 1;
      continue;
    }
    if (c.type === 'block') {
      tickets.push({
        type: 'block',
        startDay: c.start,
        endDay: c.start + c.length - 1,
        length: c.length,
        price: priceForDays(priceTable, c.length),
      });
      i = c.start + c.length;
      continue;
    }
    if (c.type === 'priorBlock') {
      tickets.push({
        type: 'block',
        startDay: c.start,
        endDay: c.start + c.length - 1,
        length: c.length,
        price: priceForDays(priceTable, c.length),
        priorDayCovered: c.absorbedDay,
      });
      priorDayCovered.push(c.absorbedDay);
      i = c.start + c.length;
      continue;
    }
    i += 1;
  }

  return { totalCost: Number.isFinite(dp[0]) ? dp[0] : 0, tickets, priorDayCovered };
}

function coveringTicketByDay(tickets) {
  const map = new Map();
  for (const t of tickets) {
    for (let d = t.startDay; d <= t.endDay; d++) map.set(d, t);
  }
  return map;
}

/**
 * Genutzte Freifahrten (FR-11/FR-12/FR-22) entstehen an zwei Arten von Tagen:
 * - Chill-Tage, die nicht innerhalb eines gekauften Tickets liegen (komplett kostenlos).
 * - Halbtag+-Tage, deren Bedarf durch ein reines 4-Stunden-Ticket gedeckt wird: der
 *   Nachmittag läuft dann über die 2 Joker-Freifahrten. Liegt der Tag stattdessen in einem
 *   Mehrtagesblock (das Ticket deckt den ganzen Tag ohnehin ab), gibt es nichts zusätzlich
 *   zu zählen.
 */
export function computeFreeRides(intensities, tickets) {
  const coveringByDay = coveringTicketByDay(tickets);
  const entries = [];
  intensities.forEach((intensity, day) => {
    const covering = coveringByDay.get(day);
    if (intensity === INTENSITY.CHILL && !covering) {
      entries.push({ day, kind: 'chill' });
    } else if (intensity === INTENSITY.SPLIT && (!covering || covering.type === 'h4')) {
      entries.push({ day, kind: 'split' });
    }
  });
  return { entries, days: entries.map((e) => e.day), rideCount: entries.length * 2 };
}

/** FR-17: Naivfall — ein Tagesticket für jeden Tag mit Ticketbedarf (Halbtag, Halbtag+ oder Vollgas). */
export function naiveDayTicketCost(intensities, priceTable) {
  const dayPrice = priceForDays(priceTable, 1) || 0;
  const neededDays = intensities.filter(
    (v) => v === INTENSITY.HALF || v === INTENSITY.SPLIT || v === INTENSITY.FULL
  ).length;
  return neededDays * dayPrice;
}

/**
 * Vollständige Auswertung für eine Person: Joker-Optimierung, Kassenpreis-Vergleich,
 * Naivfall-Vergleich, Freifahrten und KeyCard-Pfand.
 */
export function planPerson(person, intensities, prices, options = {}) {
  const jokerTable = prices.joker[person.tariff];
  const kassaTable = prices.kassa[person.tariff];

  const jokerResult = optimizeSchedule(intensities, jokerTable, options);
  const kassaResult = optimizeSchedule(intensities, kassaTable, options);
  const naiveCost = naiveDayTicketCost(intensities, jokerTable);
  const freeRides = computeFreeRides(intensities, jokerResult.tickets);

  return {
    person,
    tickets: jokerResult.tickets,
    priorDayCovered: jokerResult.priorDayCovered,
    freeRides,
    totalCost: jokerResult.totalCost,
    kassaCost: kassaResult.totalCost,
    jokerSavings: kassaResult.totalCost - jokerResult.totalCost,
    naiveCost,
    naiveSavings: naiveCost - jokerResult.totalCost,
    deposit: jokerResult.tickets.length * KEYCARD_DEPOSIT,
    // Geschätzter Gegenwert der Freifahrten: nicht in den Bedingungen beziffert. Nur Chill-Tage
    // fließen ein (ein kompletter Tag zum 4-Stunden-Ticketpreis des Jokertarifs, die günstigste
    // kostenpflichtige Alternative). Halbtag+-Tage zählen hier bewusst nicht mit: dort ist bereits
    // ein 4-Stunden-Ticket bezahlt, die Freifahrten sind nur der Nachmittags-Bonus obendrauf, kein
    // ersparter Ticketkauf.
    freeRideValue:
      freeRides.entries.filter((e) => e.kind === 'chill').length * toFiniteNumber(jokerTable.h4),
  };
}

/** Aggregiert die Einzelergebnisse für die Kennzahlenleiste (FR-20). */
export function aggregatePlan(persons, plan, prices, options = {}) {
  const perPerson = persons.map((person) =>
    planPerson(person, plan[person.id] || [], prices, options)
  );
  const totals = perPerson.reduce(
    (acc, r) => {
      acc.totalCost += r.totalCost;
      acc.jokerSavings += r.jokerSavings;
      acc.naiveSavings += r.naiveSavings;
      acc.deposit += r.deposit;
      acc.freeRideValue += r.freeRideValue;
      acc.freeRideCount += r.freeRides.rideCount;
      return acc;
    },
    { totalCost: 0, jokerSavings: 0, naiveSavings: 0, deposit: 0, freeRideValue: 0, freeRideCount: 0 }
  );
  return { perPerson, totals };
}

// ---------------------------------------------------------------------------
// Wetter (FR-34 .. FR-40)
// ---------------------------------------------------------------------------

export const WEATHER_STATES = ['sonnig', 'wolkig', 'schauer', 'regen', 'schnee', 'gewitter', 'offen'];

export const WEATHER_META = Object.freeze({
  sonnig: { icon: '☀️', label: 'Sonnig', score: 4 },
  wolkig: { icon: '⛅', label: 'Wolkig', score: 3 },
  schauer: { icon: '🌦️', label: 'Vereinzelt Schauer', score: 2 },
  regen: { icon: '🌧️', label: 'Regen', score: 1 },
  schnee: { icon: '🌨️', label: 'Schnee', score: 1 },
  gewitter: { icon: '⛈️', label: 'Gewitter', score: 0 },
  offen: { icon: '❓', label: 'Offen (keine Prognose)', score: 1.5 },
});

export function nextWeatherState(state) {
  const i = WEATHER_STATES.indexOf(state);
  return WEATHER_STATES[(i + 1) % WEATHER_STATES.length];
}

/** FR-36: WMO-Wettercode (Open-Meteo) auf interne Zustände abbilden. */
export function mapWmoCode(code) {
  if (code === 0 || code === 1) return 'sonnig';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'wolkig';
  if ([51, 53, 55, 56, 57, 80, 81].includes(code)) return 'schauer';
  if ([61, 63, 65, 66, 67, 82].includes(code)) return 'regen';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'schnee';
  if ([95, 96, 99].includes(code)) return 'gewitter';
  return 'offen';
}

/** FR-40: Score = Zustandsscore - Niederschlagswahrscheinlichkeit / 25. */
export function weatherScore(day) {
  if (!day) return -Infinity;
  const base = (WEATHER_META[day.condition] || WEATHER_META.offen).score;
  const precip = Number.isFinite(day.precip) ? day.precip : 0;
  return base - precip / 25;
}

/** FR-40: die drei wetterbesten Tage ermitteln, optional Tage per Index ausschließen (FR-09: An-/Abreisetag). */
export function bestWeatherDays(weatherDays, excludeIndices = [], count = 3) {
  const excluded = new Set(excludeIndices);
  return weatherDays
    .map((day, index) => ({ index, score: weatherScore(day) }))
    .filter((d) => !excluded.has(d.index))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((d) => d.index)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Formatierung (NFR-03)
// ---------------------------------------------------------------------------

const CURRENCY_FORMAT = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  return CURRENCY_FORMAT.format(Number.isFinite(value) ? value : 0);
}

export function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });

export function formatDayLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return { weekday: WEEKDAY_FORMAT.format(d), date: DATE_FORMAT.format(d) };
}
