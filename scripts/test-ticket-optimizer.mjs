// Dev-only test harness for the ticket-planer-saalbach.html optimizer module.
// Not shipped/loaded by the app (NFR-01 keeps the app itself a single file) — this
// script extracts the pure optimizer block by its START/END markers and evals it,
// then runs the acceptance criteria from spec section 7 (T-01..T-12) as assertions.
//
// Run with: node scripts/test-ticket-optimizer.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'ticket-planer-saalbach.html');
const html = readFileSync(htmlPath, 'utf8');

const startMarker = '/* === OPTIMIZER START ===';
const endMarker = '/* === OPTIMIZER END === */';
const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error('Optimizer markers not found in', htmlPath);
  process.exit(1);
}
const code = html.slice(startIdx, endIdx + endMarker.length);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Opt = sandbox.TicketOptimizer;

let passed = 0;
let failed = 0;

function eq(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ok   ${label}: ${actual}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}: expected ${expected}, got ${actual}`);
  }
}

function eqSet(actual, expectedArr, label) {
  const a = Array.from(actual).sort((x, y) => x - y);
  const e = [...expectedArr].sort((x, y) => x - y);
  const ok = a.length === e.length && a.every((v, i) => v === e[i]);
  if (ok) { passed++; console.log(`  ok   ${label}: [${a}]`); }
  else { failed++; console.error(`  FAIL ${label}: expected [${e}], got [${a}]`); }
}

const ADULT_JOKER = { h4: 45.00, days: [53.00, 98.00, 134.50, 166.50, 199.00, 227.00, 253.50, 276.50] };
const CHILD_JOKER = { h4: 22.50, days: [26.50, 49.00, 67.00, 83.00, 99.50, 113.50, 127.00, 138.50] };
const ADULT_KASSE = { h4: 56.00, days: [66.00, 122.50, 168.00, 208.00, 249.00, 283.50, 317.00, 345.50] };

function plan8(overrides) {
  const arr = new Array(8).fill(0);
  Object.entries(overrides).forEach(([i, v]) => { arr[Number(i)] = v; });
  return arr;
}

console.log('T-01: Erwachsener, Vollgas Tag 1,2,3');
{
  const r = Opt.optimizePerson(plan8({ 1: 3, 2: 3, 3: 3 }), ADULT_JOKER, { vortagsregel: true });
  eq(r.totalCents, 13450, 'total');
  eq(r.tickets.length, 1, 'ticket count');
  eq(r.tickets[0].length, 3, 'block length');
}

console.log('T-02: Erwachsener, Vollgas Tag 1 und 3');
{
  const r = Opt.optimizePerson(plan8({ 1: 3, 3: 3 }), ADULT_JOKER, { vortagsregel: true });
  eq(r.totalCents, 10600, 'total (two day tickets, not 3-day block)');
}

console.log('T-03: Erwachsener, Vollgas Tag 1,2,3,4');
{
  const r = Opt.optimizePerson(plan8({ 1: 3, 2: 3, 3: 3, 4: 3 }), ADULT_JOKER, { vortagsregel: true });
  eq(r.totalCents, 16650, 'total (4-day ticket)');
}

console.log('T-04: Erwachsener, Halbtag Tag 2 only');
{
  const r = Opt.optimizePerson(plan8({ 2: 2 }), ADULT_JOKER, { vortagsregel: true });
  eq(r.totalCents, 4500, 'total (4h ticket)');
  eq(r.tickets[0].type, 'h4', 'ticket type');
}

console.log('T-05: Erwachsener, Halbtag Tag0 + Vollgas Tag1, Vortagsregel AN');
{
  const r = Opt.optimizePerson(plan8({ 0: 2, 1: 3 }), ADULT_JOKER, { vortagsregel: true });
  eq(r.totalCents, 5300, 'total (single day ticket covers both)');
  eqSet(r.preDayCovered, [0], 'day 0 marked as pre-day-covered');
}

console.log('T-06: same as T-05, Vortagsregel AUS');
{
  const r = Opt.optimizePerson(plan8({ 0: 2, 1: 3 }), ADULT_JOKER, { vortagsregel: false });
  eq(r.totalCents, 9800, 'total (h4 + day ticket)');
  eq(r.tickets.length, 2, 'ticket count');
  eq(r.tickets[0].type, 'h4', 'first ticket is h4 (tie-break prefers h4+day over 2-day block)');
}

console.log('T-07: Erwachsener, Vollgas Tag1+2, Halbtag Tag3');
{
  const r = Opt.optimizePerson(plan8({ 1: 3, 2: 3, 3: 2 }), ADULT_JOKER, { vortagsregel: true });
  eq(r.totalCents, 13450, 'total (3-day block cheaper than 98+45=14300)');
}

console.log('T-08: Kind, Chill an allen 8 Tagen');
{
  const r = Opt.optimizePerson(plan8({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 }), CHILD_JOKER, { vortagsregel: true });
  eq(r.totalCents, 0, 'total');
  eq(r.freeRideDays.length, 8, 'free ride days');
  eq(r.freeRideDays.length * 2, 16, 'free rides count');
}

console.log('T-09: Kind, Chill Tag1 + Vollgas Tag2+3');
{
  const r = Opt.optimizePerson(plan8({ 1: 1, 2: 3, 3: 3 }), CHILD_JOKER, { vortagsregel: true });
  eq(r.totalCents, 4900, 'total (2-day child ticket)');
  eqSet(r.freeRideDays, [1], 'day 1 counted as free ride day');
}

console.log('T-10: Two adults Vollgas Tag1-3, two children Chill Tag1-3');
{
  const adultOpts = { vortagsregel: true };
  const a1 = Opt.optimizePerson(plan8({ 1: 3, 2: 3, 3: 3 }), ADULT_JOKER, adultOpts);
  const a2 = Opt.optimizePerson(plan8({ 1: 3, 2: 3, 3: 3 }), ADULT_JOKER, adultOpts);
  const c1 = Opt.optimizePerson(plan8({ 1: 1, 2: 1, 3: 1 }), CHILD_JOKER, adultOpts);
  const c2 = Opt.optimizePerson(plan8({ 1: 1, 2: 1, 3: 1 }), CHILD_JOKER, adultOpts);
  const total = a1.totalCents + a2.totalCents + c1.totalCents + c2.totalCents;
  const ticketCount = a1.tickets.length + a2.tickets.length + c1.tickets.length + c2.tickets.length;
  eq(total, 26900, 'gesamt');
  eq(ticketCount * 200, 400, 'pfand');
  eq(c1.freeRideDays.length + c2.freeRideDays.length, 6, 'freifahrten-tage (x2 fahrten = 12)');
}

console.log('T-11: Alle Preise auf 0');
{
  const zeroTable = { h4: 0, days: [0, 0, 0, 0, 0, 0, 0, 0] };
  const r = Opt.optimizePerson(plan8({ 1: 3, 2: 2, 5: 1 }), zeroTable, { vortagsregel: true });
  eq(r.totalCents, 0, 'total');
  eq(Number.isNaN(r.totalCents), false, 'not NaN');
}

console.log('T-12 is a UI/persistence behavior (weather reset, plan retained) — not covered by the pure optimizer, verified manually / via app logic.');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
