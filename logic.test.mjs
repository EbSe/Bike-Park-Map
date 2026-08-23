// Unit-Tests für logic.js — bilden die Akzeptanzkriterien aus Abschnitt 7 der
// Anforderungsspezifikation eins zu eins ab. Keine Abhängigkeiten, Aufruf: `node logic.test.mjs`.

import {
  INTENSITY,
  DEFAULT_PRICES,
  optimizeSchedule,
  planPerson,
  aggregatePlan,
  computeFreeRides,
  KEYCARD_DEPOSIT,
} from './logic.js';

const { OFF, CHILL, HALF, FULL } = INTENSITY;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message}`);
  }
}

function assertClose(actual, expected, msg, eps = 0.001) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${msg}: erwartet ${expected}, erhalten ${actual}`);
  }
}

function days(n, fill = OFF) {
  return new Array(n).fill(fill);
}

const adultJoker = DEFAULT_PRICES.joker.adult;
const childJoker = DEFAULT_PRICES.joker.child;

// T-01: Erwachsener, Vollgas an Tag 1,2,3 -> 3-Tages-Ticket, 134,50 €
test('T-01 Vollgas 3 Tage am Stück -> ein 3-Tages-Block', () => {
  const intensities = days(8);
  intensities[1] = FULL;
  intensities[2] = FULL;
  intensities[3] = FULL;
  const result = optimizeSchedule(intensities, adultJoker, {});
  assertClose(result.totalCost, 134.5, 'Gesamtkosten');
  if (result.tickets.length !== 1) throw new Error(`erwartet 1 Ticket, erhalten ${result.tickets.length}`);
  if (result.tickets[0].length !== 3) throw new Error('erwartet Blocklänge 3');
});

// T-02: Vollgas Tag 1 und 3 (Tag 2 aus) -> zwei Tagestickets, 106,00 €
test('T-02 Vollgas Tag 1+3 mit Lücke -> zwei Einzeltickets statt Block', () => {
  const intensities = days(8);
  intensities[1] = FULL;
  intensities[3] = FULL;
  const result = optimizeSchedule(intensities, adultJoker, {});
  assertClose(result.totalCost, 106.0, 'Gesamtkosten');
  if (result.tickets.length !== 2) throw new Error(`erwartet 2 Tickets, erhalten ${result.tickets.length}`);
});

// T-03: Vollgas Tag 1-4 -> 4-Tages-Ticket, 166,50 € (nicht 4x53)
test('T-03 Vollgas 4 Tage am Stück -> ein 4-Tages-Block', () => {
  const intensities = days(8);
  [1, 2, 3, 4].forEach((d) => (intensities[d] = FULL));
  const result = optimizeSchedule(intensities, adultJoker, {});
  assertClose(result.totalCost, 166.5, 'Gesamtkosten');
  if (result.tickets.length !== 1) throw new Error(`erwartet 1 Ticket, erhalten ${result.tickets.length}`);
});

// T-04: Halbtag an Tag 2, sonst nichts -> 4-Stunden-Ticket, 45,00 €
test('T-04 einzelner Halbtag -> 4-Stunden-Ticket', () => {
  const intensities = days(8);
  intensities[2] = HALF;
  const result = optimizeSchedule(intensities, adultJoker, {});
  assertClose(result.totalCost, 45.0, 'Gesamtkosten');
  if (result.tickets[0].type !== 'h4') throw new Error('erwartet 4h-Ticket');
});

// T-05: Halbtag Tag0 + Vollgas Tag1, Vortagsregel an -> Tagesticket Tag1, 53,00 €, Tag0 markiert
test('T-05 Vortagsregel aktiv deckt Halbtag am Vortag ab', () => {
  const intensities = days(8);
  intensities[0] = HALF;
  intensities[1] = FULL;
  const result = optimizeSchedule(intensities, adultJoker, { priorDayRule: true });
  assertClose(result.totalCost, 53.0, 'Gesamtkosten');
  if (result.tickets.length !== 1) throw new Error(`erwartet 1 Ticket, erhalten ${result.tickets.length}`);
  if (result.priorDayCovered[0] !== 0) throw new Error('Tag 0 muss als vortags-abgedeckt markiert sein');
});

// T-06: wie T-05, Vortagsregel aus -> 4h-Ticket + Tagesticket, 98,00 €
test('T-06 Vortagsregel inaktiv -> zwei separate Tickets', () => {
  const intensities = days(8);
  intensities[0] = HALF;
  intensities[1] = FULL;
  const result = optimizeSchedule(intensities, adultJoker, { priorDayRule: false });
  assertClose(result.totalCost, 98.0, 'Gesamtkosten');
  if (result.tickets.length !== 2) throw new Error(`erwartet 2 Tickets, erhalten ${result.tickets.length}`);
  if (result.tickets[0].type !== 'h4') throw new Error('Tag 0 muss über 4h-Ticket laufen (Tie-Break)');
  if (result.priorDayCovered.length !== 0) throw new Error('keine Vortagsabdeckung erwartet');
});

// T-07: Vollgas Tag1+2, Halbtag Tag3 -> 3-Tages-Ticket, 134,50 € (günstiger als 98+45)
test('T-07 Block über Vollgas+Halbtag günstiger als Einzeltickets', () => {
  const intensities = days(8);
  intensities[1] = FULL;
  intensities[2] = FULL;
  intensities[3] = HALF;
  const result = optimizeSchedule(intensities, adultJoker, {});
  assertClose(result.totalCost, 134.5, 'Gesamtkosten');
  if (result.tickets.length !== 1) throw new Error(`erwartet 1 Ticket, erhalten ${result.tickets.length}`);
});

// T-08: Kind, Chill an allen 8 Tagen -> 0,00 €, 16 Freifahrten
test('T-08 durchgehend Chill -> kostenlos, 16 Freifahrten', () => {
  const intensities = days(8, CHILL);
  const result = optimizeSchedule(intensities, childJoker, {});
  assertClose(result.totalCost, 0, 'Gesamtkosten');
  const freeRides = computeFreeRides(intensities, result.tickets);
  if (freeRides.rideCount !== 16) throw new Error(`erwartet 16 Fahrten, erhalten ${freeRides.rideCount}`);
});

// T-09: Kind, Chill Tag1 + Vollgas Tag2+3 -> 2-Tages-Ticket 49,00 €, Tag1 Freifahrtstag mit 2 Fahrten
test('T-09 Chill-Tag bleibt Freifahrtstag, wenn außerhalb des Blocks', () => {
  const intensities = days(8);
  intensities[1] = CHILL;
  intensities[2] = FULL;
  intensities[3] = FULL;
  const result = optimizeSchedule(intensities, childJoker, {});
  assertClose(result.totalCost, 49.0, 'Gesamtkosten');
  const freeRides = computeFreeRides(intensities, result.tickets);
  if (freeRides.days.length !== 1 || freeRides.days[0] !== 1) {
    throw new Error(`erwartet Freifahrtstag [1], erhalten ${JSON.stringify(freeRides.days)}`);
  }
  if (freeRides.rideCount !== 2) throw new Error('erwartet 2 Fahrten');
});

// T-10: 2 Erwachsene Vollgas Tag1-3, 2 Kinder Chill Tag1-3 -> Gesamt 269,00 €, Pfand 4,00 €, 12 Freifahrten
test('T-10 Gruppenauswertung über mehrere Personen', () => {
  const persons = [
    { id: 'a1', name: 'A1', short: 'A1', tariff: 'adult' },
    { id: 'a2', name: 'A2', short: 'A2', tariff: 'adult' },
    { id: 'k1', name: 'K1', short: 'K1', tariff: 'child' },
    { id: 'k2', name: 'K2', short: 'K2', tariff: 'child' },
  ];
  const adultPlan = days(8);
  [1, 2, 3].forEach((d) => (adultPlan[d] = FULL));
  const childPlan = days(8);
  [1, 2, 3].forEach((d) => (childPlan[d] = CHILL));
  const plan = { a1: adultPlan, a2: adultPlan, k1: childPlan, k2: childPlan };

  const { totals } = aggregatePlan(persons, plan, DEFAULT_PRICES, {});
  assertClose(totals.totalCost, 269.0, 'Gesamtkosten');
  assertClose(totals.deposit, 4.0, 'KeyCard-Pfand');
  if (totals.freeRideCount !== 12) throw new Error(`erwartet 12 Freifahrten, erhalten ${totals.freeRideCount}`);
});

// T-11: alle Preise auf 0 -> Gesamt 0,00 €, keine NaN/Division-durch-Null
test('T-11 Nullpreise erzeugen keine NaN-Werte', () => {
  const zeroPrices = {
    joker: {
      adult: { h4: 0, days: new Array(9).fill(0) },
      youth: { h4: 0, days: new Array(9).fill(0) },
      child: { h4: 0, days: new Array(9).fill(0) },
    },
    kassa: {
      adult: { h4: 0, days: new Array(9).fill(0) },
      youth: { h4: 0, days: new Array(9).fill(0) },
      child: { h4: 0, days: new Array(9).fill(0) },
    },
  };
  const persons = [{ id: 'p', name: 'P', short: 'P', tariff: 'adult' }];
  const plan = { p: [FULL, HALF, CHILL, OFF, FULL, FULL, HALF, FULL] };
  const { perPerson, totals } = aggregatePlan(persons, plan, zeroPrices, {});
  if (!Number.isFinite(totals.totalCost)) throw new Error('totalCost ist nicht endlich (NaN/Infinity)');
  assertClose(totals.totalCost, 0, 'Gesamtkosten');
  if (Number.isNaN(perPerson[0].jokerSavings)) throw new Error('jokerSavings ist NaN');
  if (Number.isNaN(perPerson[0].naiveSavings)) throw new Error('naiveSavings ist NaN');
});

// zusätzliche Regressionsabsicherung für die DP-Grundformel (nicht explizit in Abschnitt 7, aber
// von den Domänenregeln verlangt): eine reine Vollgas-Woche ohne Lücken bleibt ein einziger Block.
test('Zusatzcheck: KeyCard-Pfand pro gekauftem Ticket (DR-11)', () => {
  const intensities = days(8);
  intensities[1] = FULL;
  intensities[3] = FULL; // Lücke -> 2 Tickets
  const person = { id: 'p', name: 'P', short: 'P', tariff: 'adult' };
  const result = planPerson(person, intensities, DEFAULT_PRICES, {});
  assertClose(result.deposit, 2 * KEYCARD_DEPOSIT, 'Pfand für 2 Tickets');
});

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) process.exit(1);
