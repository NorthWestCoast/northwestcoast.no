import { planPriceUpdate, type CurrentProduct } from '../lib/price-plan.ts';

const L = (id: string, num: string, price: number, over: Partial<CurrentProduct> = {}): CurrentProduct => ({
  id, product_number: num, name: `Leider ${id}`, kind: 'ladder', steps: 10, price_nok: price, price_on_request: false, active: true, ...over,
});
const C = (id: string, num: string, price: number): CurrentProduct => ({
  id, product_number: num, name: `Oppbevaringsskap ${num}`, kind: 'cabinet', steps: null, price_nok: price, price_on_request: false, active: true,
});
const current = [
  L('l2', 'ARG-2ML', 0, { steps: null, price_on_request: true }),
  L('l3', '400-031', 9499), L('l6', '400-034', 13999),
  C('c1', 'ASC-LC3-5', 9000), C('c2', 'ASC-LC5-6', 9500),
];
/** Bygger skjemaet slik admin-siden sender det, med valgfrie overstyringer. */
function form(over: Record<string, string | null> = {}, skip: string[] = []) {
  const fd = new FormData();
  for (const p of current) {
    if (skip.includes(p.id)) continue;
    fd.set(`p:${p.id}:number`, p.product_number);
    fd.set(`p:${p.id}:price`, String(p.price_nok));
    if (p.kind === 'ladder') { fd.set(`p:${p.id}:steps`, String(p.steps ?? '')); if (p.price_on_request) fd.set(`p:${p.id}:request`, 'on'); }
    if (p.active) fd.set(`p:${p.id}:active`, 'on');
  }
  for (const [k, v] of Object.entries(over)) {
    if (v === null) fd.delete(k);
    else fd.set(k, v);
  }
  return fd;
}
let failed = 0;
const check = (name: string, cond: boolean, detail = '') => { console.log(`${cond ? 'OK  ' : 'FEIL'} ${name}${cond ? '' : '  ← ' + detail}`); if (!cond) failed++; };
const run = (fd: FormData) => planPriceUpdate(current, fd);

let r = run(form());
check('ingen endringer gir ingen patcher', r.ok && r.patches.size === 0, JSON.stringify(r));

r = run(form({ 'p:l6:price': '14999' }));
check('vanlig prisendring gir kun price_nok', r.ok && r.patches.get('l6')?.price_nok === 14999 && Object.keys(r.patches.get('l6')!).length === 1, JSON.stringify(r));

r = run(form({ 'p:l3:price': '94990' }));
check('tastefeil (+900 %) stoppes uten bekreftelse', !r.ok && /Store endringer/.test(r.error), JSON.stringify(r));
r = run(form({ 'p:l3:price': '94990', confirm_large: 'on' }));
check('samme endring går gjennom med bekreftelse', r.ok && r.patches.get('l3')?.price_nok === 94990, JSON.stringify(r));
r = run(form({ 'p:l6:price': '5000' }));
check('stort prisfall (-64 %) stoppes også', !r.ok && /Store endringer/.test(r.error), JSON.stringify(r));

r = run(form({ 'p:l6:price': '0' }));
check('pris 0 uten «på forespørsel» avvises', !r.ok && /sett en pris/.test(r.error), JSON.stringify(r));
r = run(form({ 'p:l6:price': '12abc' }));
check('ikke-numerisk pris avvises', !r.ok && /hele kroner/.test(r.error), JSON.stringify(r));
r = run(form({ 'p:l6:price': '-5' }));
check('negativ pris avvises', !r.ok, JSON.stringify(r));
r = run(form({ 'p:l6:price': '13999.50' }));
check('ører avvises (kun hele kroner)', !r.ok, JSON.stringify(r));

r = run(form({ 'p:l2:price': '8000', 'p:l2:steps': '7', 'p:l2:request': null }));
check('2 m kan ikke få fast pris med plassholdernummer', !r.ok && /midlertidige produktnummeret/.test(r.error), JSON.stringify(r));
r = run(form({ 'p:l2:price': '8000', 'p:l2:steps': '7', 'p:l2:request': null, 'p:l2:number': '400-030' }));
check('2 m med offisielt nummer, trinn og pris går gjennom', r.ok && JSON.stringify(r.patches.get('l2')) === JSON.stringify({ product_number: '400-030', price_nok: 8000, steps: 7, price_on_request: false }), JSON.stringify(r.ok ? [...r.patches] : r));
r = run(form({ 'p:l2:price': '8000', 'p:l2:request': null, 'p:l2:number': '400-030' }));
check('fast pris uten antall trinn avvises', !r.ok && /antall trinn/.test(r.error), JSON.stringify(r));

r = run(form({ 'p:l3:active': null, 'p:l6:active': null }));
check('kan ikke deaktivere alle priste leidere', !r.ok && /Minst én leider/.test(r.error), JSON.stringify(r));
r = run(form({ 'p:l3:active': null }));
check('å deaktivere én leider er ok', r.ok && r.patches.get('l3')?.active === false, JSON.stringify(r));

r = run(form({ 'p:c2:number': 'ASC-LC3-5' }));
check('duplisert produktnummer avvises', !r.ok && /brukes også/.test(r.error), JSON.stringify(r));
r = run(form({ 'p:c1:number': 'ASC-LC3-5 ' }));
check('mellomrom trimmes (ingen endring)', r.ok && r.patches.size === 0, JSON.stringify(r));
r = run(form({ 'p:c1:number': '' }));
check('tomt produktnummer avvises', !r.ok, JSON.stringify(r));

r = run(form({ 'p:l6:price': '14999' }, ['c1', 'c2']));
check('rader som ikke er i skjemaet røres ikke (ikke deaktivert)', r.ok && !r.patches.has('c1') && !r.patches.has('c2') && r.patches.has('l6'), JSON.stringify(r.ok ? [...r.patches] : r));
r = run(form({ 'p:c2:number': 'ASC-LC3-5' }, ['c1']));
check('nummer i bruk på rad utenfor skjemaet regnes som opptatt', !r.ok, JSON.stringify(r));

// ── Prislogikken på bestillingssiden: halvmetere og skap alene (lib/pricing.ts) ──
const pricing = await import('../lib/pricing.ts');
const {
  PRICE_TABLE, cabinetLineTotal, cabinetRowForCustom, fitsRange, fmtLength, halfMetreLengths,
  halfMetresBetween, isCustomLength, isStandardLength, makePricing, orderTotal, unitPrice,
} = pricing;

check('standardlengde med skap: leider + skap', unitPrice(6, true) === 13999 + 9500, String(unitPrice(6, true)));
check('halvmeter har ingen listepris (ikke prisen til en annen lengde)', unitPrice(4.5, false) === 0 && unitPrice(4.5, true) === 0, String(unitPrice(4.5, false)));
check('lengde på forespørsel (2 m) teller 0', unitPrice(2, true) === 0);
check(
  'summen teller bare linjer med fast pris',
  orderTotal([{ length: 3, qty: 2, cabinet: false }, { length: 4.5, qty: 3, cabinet: true }, { length: 2, qty: 1, cabinet: false }]) === 2 * 9499,
);

const halves = halfMetreLengths(PRICE_TABLE);
check('halvmeterne ligger mellom korteste og lengste standardlengde', halves[0] === 2.5 && halves[halves.length - 1] === 14.5 && halves.length === 13, JSON.stringify(halves));
check('ingen halvmeter er en standardlengde', halves.every((v) => !isStandardLength(v) && isCustomLength(v)));
check('halvmetere uten prisliste gir tom liste', halfMetresBetween([]).length === 0 && halfMetresBetween([6]).length === 0);
check('makePricing gir samme halvmetere', JSON.stringify(makePricing(PRICE_TABLE).halfLengths) === JSON.stringify(halves));

check('spesiallengde: hele og halve meter fra 1,5 til 30', [1.5, 4.5, 16, 30].every(isCustomLength));
check('spesiallengde: avviser 4,3, 1, 30,5 og ikke-tall', ![4.3, 1, 30.5, Number.NaN, Number.POSITIVE_INFINITY].some(isCustomLength));

check('skap til 4,5 m er skapet til 5 m', cabinetRowForCustom(4.5)?.cabinetName === 'ASC-LC3-5', cabinetRowForCustom(4.5)?.cabinetName);
check('skap til 5,5 m er skapet til 6 m', cabinetRowForCustom(5.5)?.cabinetName === 'ASC-LC5-6', cabinetRowForCustom(5.5)?.cabinetName);
check('skap til 2,5 m hopper ikke til en lengde uten skap', cabinetRowForCustom(2.5)?.length === 3);
check('ingen skap over lengste standardlengde', cabinetRowForCustom(15.5) === null);

check('skapets lengder: spenn, én lengde, hull og tom', fitsRange([5, 3, 4]) === '3–5' && fitsRange([6]) === '6' && fitsRange([3, 5]) === '3, 5' && fitsRange([]) === '');
check('lengde med norsk og engelsk desimaltegn', fmtLength(4.5) === '4,5' && fmtLength(4.5, 'en') === '4.5' && fmtLength(6) === '6');

const cab = { productId: 'c1', productNumber: 'ASC-LC3-5', name: 'Oppbevaringsskap ASC-LC3-5', model: 'ASC-LC3-5', price: 9000, fitsLengths: [3, 4, 5] };
check('skap alene: pris ganger antall', cabinetLineTotal(cab, 2) === 18000);
check('skap alene på forespørsel teller 0', cabinetLineTotal({ ...cab, onRequest: true }, 2) === 0);

console.log(failed === 0 ? '\nALLE TESTER BESTÅTT' : `\n${failed} FEILET`);
process.exit(failed ? 1 : 0);
