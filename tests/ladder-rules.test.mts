/**
 * Kontroll av regnestykket i leiderkalkulatoren.
 *
 *   node tests/ladder-rules.test.mts
 *
 * lib/ladder-rules.ts importerer './pricing' uten filendelse (slik Next vil ha
 * det). Node trenger endelsen, så kroken under legger den til.
 */
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const rules = await import('../lib/ladder-rules.ts');
const { PRICE_TABLE } = await import('../lib/pricing.ts');
const {
  DEFAULT_WATERLINE_MARGIN_M,
  HEEL_ANGLE_DEG,
  calculate,
  halfLengths,
  halfStepFor,
  heelMargin,
  isOnRequestLength,
  lengthOptions,
  requiredLength,
  rowForRequired,
} = rules;

let failed = 0;
const check = (name: string, cond: boolean, detail: unknown = '') => {
  console.log(`${cond ? 'OK  ' : 'FEIL'} ${name}${cond ? '' : '  ← ' + JSON.stringify(detail)}`);
  if (!cond) failed++;
};
const near = (a: number, b: number, eps = 0.005) => Math.abs(a - b) <= eps;

// ── Tillegget: (B / 2) × tan(20°) ──────────────────────────────────────────
check('krengevinkelen er 20°', HEEL_ANGLE_DEG === 20);
check('bredde 12 m gir 2,18 m', heelMargin(12) === 2.18, heelMargin(12));
check('bredde 4 m gir 0,73 m', heelMargin(4) === 0.73, heelMargin(4));
check('bredde 3,42 m gir 0,62 m', heelMargin(3.42) === 0.62, heelMargin(3.42));
check('tillegget er ca. 0,182 × B', near(heelMargin(10) / 10, 0.182, 0.0005), heelMargin(10));
check('tillegget følger formelen for andre vinkler', near(heelMargin(10, 45), 5), heelMargin(10, 45));
check('uten bredde er det utregnede tillegget 0', heelMargin(0) === 0 && heelMargin(Number.NaN) === 0 && heelMargin(-3) === 0);

// Geometrien bak formelen: punktet (B/2, −tillegg) på skutesiden ligger i
// vannflaten når skroget er dreid 20° om senterlinjen i vannlinjen.
{
  const beam = 12;
  const theta = (HEEL_ANGLE_DEG * Math.PI) / 180;
  const exact = (beam / 2) * Math.tan(theta);
  const height = (beam / 2) * Math.sin(theta) - exact * Math.cos(theta);
  check('nedre ende ligger i vannflaten ved 20°', Math.abs(height) < 1e-9, height);
}

// ── Nødvendig lengde ───────────────────────────────────────────────────────
let r = calculate({ freeboard: 1.5, mountHeight: 1, beam: 12 });
check('F 1,5 + h 1 + tillegg 2,18 = 4,68 m', r.required === 4.68 && r.margin === 2.18 && !r.marginManual, r);
check('4,68 m gir 5 m standard', r.recommended?.length === 5 && r.slack === 0.32, r);
check('4,68 m gir ingen halvmeter (nærmeste er 5,0)', r.halfStep === null, r);

r = calculate({ freeboard: 1.5, mountHeight: 1, beam: 12, margin: 1, marginManual: true });
check('«sett tillegget selv» overstyrer bredden', r.required === 3.5 && r.margin === 1 && r.marginManual, r);

r = calculate({ freeboard: 1.5, mountHeight: 1, margin: DEFAULT_WATERLINE_MARGIN_M });
check('uten bredde brukes det manuelle tallet', r.required === 3 && r.margin === 0.5 && r.marginManual, r);
r = calculate({ freeboard: 1.5, mountHeight: 1, beam: 0, margin: 0.5 });
check('bredde 0 regnes som tom', r.required === 3 && r.marginManual, r);

// Den gamle signaturen ({ freeboard, mountHeight, margin }) virker som før.
check('gammel signatur gir samme svar som før', requiredLength({ freeboard: 2.2, mountHeight: 0.4, margin: 0.5 }) === 3.1);
check('tomme felt gir 0', requiredLength({ freeboard: 0, mountHeight: 0 }) === 0);
check('avrunding til hele centimeter', requiredLength({ freeboard: 1.005, mountHeight: 0.333, margin: 0.5 }) === 1.84,
  requiredLength({ freeboard: 1.005, mountHeight: 0.333, margin: 0.5 }));

// ── Anbefaling ─────────────────────────────────────────────────────────────
check('nøyaktig 5 m gir 5 m', rowForRequired(5)?.length === 5);
check('5,01 m gir 6 m', rowForRequired(5.01)?.length === 6);
r = calculate({ freeboard: 0.4, mountHeight: 0, margin: 0.5 });
check('lite behov gir korteste leider', r.recommended?.length === 2 && r.atMinimum && r.halfStep === null, r);
r = calculate({ freeboard: 12, mountHeight: 2, beam: 12 });
check('over 15 m gir ingen anbefaling', r.tooLong && r.recommended === null && r.halfStep === null, r);
r = calculate({ freeboard: 13, mountHeight: 0, margin: 2 });
check('nøyaktig 15 m er ikke for langt', !r.tooLong && r.recommended?.length === 15, r);

// ── Halvmetere ─────────────────────────────────────────────────────────────
const half = (required: number) => halfStepFor(required, rowForRequired(required));
check('behov 4,3 m → standard 5 m, halvmeter 4,5 m', rowForRequired(4.3)?.length === 5 && half(4.3) === 4.5, half(4.3));
check('behov 4,5 m → halvmeter 4,5 m', half(4.5) === 4.5, half(4.5));
check('behov 4,51 m → ingen halvmeter (5,0 er standard)', half(4.51) === null, half(4.51));
check('behov 4,0 m → ingen halvmeter', half(4) === null, half(4));
check('behov 14,2 m → halvmeter 14,5 m', half(14.2) === 14.5, half(14.2));
check('behov 2,2 m → halvmeter 2,5 m', half(2.2) === 2.5, half(2.2));
check('behov 1,3 m → ingen halvmeter under korteste standardlengde', half(1.3) === null, half(1.3));
check('behov 15,2 m → ingen halvmeter over lengste standardlengde', half(15.2) === null, half(15.2));
r = calculate({ freeboard: 2.2, mountHeight: 0.4, beam: 9.4 });
check('F 2,2 + h 0,4 + B 9,4 → 4,31 m, 5 m standard, 4,5 m på forespørsel',
  r.required === 4.31 && r.recommended?.length === 5 && r.halfStep === 4.5, r);

const halves = halfLengths();
check('halvmeterne går fra 2,5 til 14,5', halves[0] === 2.5 && halves[halves.length - 1] === 14.5 && halves.length === 13, halves);
check('alle halvmeterne slutter på ,5', halves.every((value) => value % 1 === 0.5), halves);

const options = lengthOptions();
check('nedtrekkslista har 14 standardlengder og 13 halvmetere',
  options.filter((o) => !o.half).length === 14 && options.filter((o) => o.half).length === 13, options.length);
check('nedtrekkslista er sortert', options.every((o, i) => i === 0 || options[i - 1].length < o.length));
check('standardlengdene er ikke merket som halvmeter',
  options.filter((o) => !o.half).every((o) => PRICE_TABLE.some((row) => row.length === o.length)));
check('4,5 m er på forespørsel, 5 m er det ikke', isOnRequestLength(4.5) && !isOnRequestLength(5));

// En prisliste med hull (7 m mangler) skal ikke gi hele meter som «halvmeter».
const gappy = PRICE_TABLE.filter((row) => row.length !== 7);
check('hull i prislista: behov 6,8 m gir 8 m og ingen halvmeter',
  rowForRequired(6.8, gappy)?.length === 8 && halfStepFor(6.8, rowForRequired(6.8, gappy), gappy) === null);
check('hull i prislista: behov 6,2 m gir 8 m og halvmeter 6,5 m',
  halfStepFor(6.2, rowForRequired(6.2, gappy), gappy) === 6.5);
check('tom prisliste gir ingen halvmetere', halfLengths([]).length === 0 && lengthOptions([]).length === 0);

console.log(failed === 0 ? '\nAlle kontroller bestått.' : `\n${failed} kontroll(er) feilet.`);
process.exit(failed === 0 ? 0 : 1);
