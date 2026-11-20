import { bottleneck, buildable, describeQty, fmtQty, num, parseQty, requiredQty, stockState, usagePeriod } from '../lib/stock.ts';

let failed = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { failed += 1; console.error(`FEILET: ${what}`); }
};

ok(num('8,5') === 8.5 && num('1 250') === 1250 && num(null) === 0 && num('x') === 0, 'num() tolker norske tall');
ok(parseQty('8,5') === 8.5 && parseQty('12') === 12 && parseQty('-3.25') === -3.25, 'parseQty() godtar komma og punktum');
ok(parseQty('1,2345') === null && parseQty('abc') === null && parseQty('') === null && parseQty(null) === null, 'parseQty() avviser det som ikke er en mengde');
ok(fmtQty(13) === '13' && fmtQty(8.5, 'm') === '8,5 m' && fmtQty('11.550', 'm') === '11,55 m', 'fmtQty() skriver uten unødige nuller');

// Stykkliste: fast mengde og mengde per meter.
ok(requiredQty({ qty: 13, qty_per_metre: 0 }, 4) === 13, 'en standardlengde bruker den faste mengden');
ok(requiredQty({ qty: 1, qty_per_metre: 3 }, 5.5) === 17.5, 'en spesiallengde følger lengden');
ok(requiredQty({ qty: 0, qty_per_metre: 2.1 }, 5.5) === 11.55, 'og regner uten avrundingsfeil');
ok(describeQty({ qty: 1, qty_per_metre: 3 }, 'stk') === '1 stk + 3 stk per meter', 'describeQty() viser begge delene');
ok(describeQty({ qty: 8.5, qty_per_metre: 0 }, 'm') === '8,5 m', 'eller bare den faste');

// Hvor mange kan bygges.
const parts = [
  { name: 'trinn', qty: 13, qty_per_metre: 0, available: 87 },
  { name: 'tau', qty: 8.5, qty_per_metre: 0, available: 20 },
];
ok(buildable(parts, 4) === 2, 'den knappeste delen avgjør hvor mange som kan bygges');
ok(bottleneck(parts, 4)?.name === 'tau', 'og pekes ut');
ok(buildable([], 4) === null, 'uten stykkliste finnes det ikke noe svar');
ok(buildable([{ qty: 13, qty_per_metre: 0, available: -4 }], 4) === 0, 'negativ beholdning gir null, ikke et negativt antall');

ok(stockState({ on_hand: 5, available: 5, reorder_point: 0 }) === 'ok', 'uten minimum er alt over null i orden');
ok(stockState({ on_hand: 30, available: 12, reorder_point: 20 }) === 'low', 'bundet beholdning teller mot minimum');
ok(stockState({ on_hand: 0, available: 0, reorder_point: 0 }) === 'empty', 'tomt');
ok(stockState({ on_hand: -2, available: -2, reorder_point: 0 }) === 'negative', 'negativ beholdning må telles');

ok(usagePeriod('i-ar', '2026-11-20').from === '2026-01-01', 'hittil i år starter 1. januar');
ok(usagePeriod('12-mnd', '2026-11-20').from === '2025-11-21', 'siste 12 måneder');
ok(usagePeriod('i-fjor', '2026-11-20').to === '2025-12-31', 'i fjor');
ok(usagePeriod('alt', '2026-11-20').from === null, 'hele perioden har ingen grense');

if (failed) { console.error(`${failed} test(er) feilet.`); process.exit(1); }
console.log('Lagertestene (regning) består.');
