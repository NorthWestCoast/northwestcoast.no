import {
  PRICE_TABLE,
  halfMetreLengths,
  isCustomLength,
  isStandardLength,
  type PriceRow,
  type PriceTable,
} from './pricing';

/**
 * Dimensjoneringsregler for leiderkalkulatoren.
 *
 * ⚠️ LES DETTE FØR DU ENDRER TALL HER
 * Konstantene under er FORUTSETNINGER, ikke siterte krav fra ISO 799-1:2019,
 * SOLAS eller Sjøfartsdirektoratet. De er samlet på ett sted nettopp fordi de
 * må kvalitetssikres mot gjeldende regelverk før kalkulatoren markedsføres som
 * et compliance-verktøy. Kalkulatoren viser hele regnestykket til brukeren, så
 * en feil forutsetning er synlig – men den bør uansett rettes her.
 */

/**
 * Krengevinkelen tillegget under vannlinjen regnes ut for, i grader.
 * FORUTSETNING – ikke et regelverkstall. Se heelMargin() under.
 */
export const HEEL_ANGLE_DEG = 20;

/**
 * Tillegg under vannlinjen når bredden på fartøyet ikke er oppgitt, i meter.
 * FORUTSETNING – ikke et regelverkstall. Feltet er redigerbart i skjemaet slik
 * at teknikeren kan legge inn kravet fra eget klasseselskap eller flaggstat.
 */
export const DEFAULT_WATERLINE_MARGIN_M = 0.5;

/**
 * Godkjenningen som er omtalt på nettstedet («Godkjent for norske fartøy under
 * 15 meter») gjelder fartøy under denne lengden. Over dette viser kalkulatoren
 * en oppfordring om å ta kontakt i stedet for å påstå at leideren er godkjent.
 */
export const APPROVED_VESSEL_LOA_LIMIT_M = 15;

export const maxLength = (table: PriceTable = PRICE_TABLE) =>
  Math.max(...table.map((r) => r.length));
export const minLength = (table: PriceTable = PRICE_TABLE) =>
  Math.min(...table.map((r) => r.length));

export type CalcInput = {
  /** Fribord (F): loddrett høyde fra vannlinjen til innstigningsdekket, i meter. */
  freeboard: number;
  /** Høyde (h) fra dekket opp til festepunktet (rekke, skansekledning), i meter. */
  mountHeight: number;
  /** Bredde på fartøyet (B), i meter. Utelatt eller 0 betyr at den ikke er kjent. */
  beam?: number;
  /**
   * Tillegg under vannlinjen satt for hånd, i meter. Brukes når bredden
   * mangler, eller når marginManual er sann.
   */
  margin?: number;
  /** Bruk `margin` selv om bredden er kjent (krav fra klasseselskap/flaggstat). */
  marginManual?: boolean;
};

export type CalcResult = {
  /** Summen brukeren må dekke, i meter. */
  required: number;
  /** Tillegget under vannlinjen som er brukt i summen, i meter. */
  margin: number;
  /** Tillegget er satt for hånd (ikke regnet ut fra bredden). */
  marginManual: boolean;
  /** Krengevinkelen et utregnet tillegg gjelder for, i grader. */
  heelDeg: number;
  /** Korteste standardleider som dekker behovet, eller null hvis over maks. */
  recommended: PriceRow | null;
  /** Hvor mye lengre den anbefalte leideren er enn behovet, i meter. */
  slack: number;
  /**
   * Halvmeterlengde som også dekker behovet og er kortere enn den anbefalte
   * standardleideren (behov 4,3 m → standard 5 m, halvmeter 4,5 m). Lages på
   * forespørsel og har ingen listepris. Null når det ikke finnes noen.
   */
  halfStep: number | null;
  /** Behovet er større enn lengste standardleider. */
  tooLong: boolean;
  /** Behovet dekkes av den korteste leideren i sortimentet. */
  atMinimum: boolean;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Tillegg under vannlinjen regnet ut fra bredden, i meter:
 *
 *     tillegg = (B / 2) × tan(krengevinkel)        ≈ 0,182 × B ved 20°
 *
 * Begrunnelse: Med rette skipssider og krenging om senterlinjen i vannlinjen
 * flytter vannlinjen seg (B/2)·tan θ nedover skutesiden på den siden som
 * løftes. Leideren ligger an mot skutesiden, så den må være så mye lengre for
 * at nedre ende fortsatt skal nå vannflaten når fartøyet krenger θ grader.
 *
 * FORUTSETNING – ikke et regelverkstall. Forenklingen (rette sider, dreiing om
 * senterlinjen i vannlinjen, ingen trim) og selve vinkelen må kvalitetssikres.
 * Brukeren kan derfor alltid overstyre tillegget i skjemaet.
 */
export function heelMargin(beam: number, heelDeg: number = HEEL_ANGLE_DEG): number {
  if (!(beam > 0)) return 0;
  return round((beam / 2) * Math.tan((heelDeg * Math.PI) / 180));
}

/**
 * Hvilket tillegg som gjelder: utregnet fra bredden når den er kjent og
 * brukeren ikke har valgt å sette tillegget selv – ellers det manuelle tallet.
 */
export function waterlineMargin(input: CalcInput): { margin: number; manual: boolean } {
  const beam = input.beam ?? 0;
  if (!input.marginManual && beam > 0) return { margin: heelMargin(beam), manual: false };
  return { margin: input.margin || 0, manual: true };
}

/** Nødvendig lengde = F + h + tillegg under vannlinjen. */
export function requiredLength(input: CalcInput): number {
  const sum = (input.freeboard || 0) + (input.mountHeight || 0) + waterlineMargin(input).margin;
  return round(Math.max(0, sum));
}

export function rowForRequired(required: number, table: PriceTable = PRICE_TABLE): PriceRow | null {
  return [...table].sort((a, b) => a.length - b.length).find((row) => row.length >= required) ?? null;
}

/* ── Halvmetere ─────────────────────────────────────────────────────────────
 * Standardlengdene er hele meter og står i prislista. Halvmetere (4,5 m,
 * 5,5 m …) kan bestilles, men lages på forespørsel: de er ikke egne produkter,
 * har ingen listepris og finnes derfor ikke i PriceTable.
 *
 * Hvilke lengder som kan bestilles, er bestemt i lib/pricing.ts (samme regel
 * som /api/order og databasen bruker). Kalkulatoren tilbyr aldri noe annet.
 */

/** Lengden står ikke i prislista, altså en halvmeter på forespørsel. */
export const isOnRequestLength = (length: number, table: PriceTable = PRICE_TABLE) =>
  !isStandardLength(length, table);

/** Halvmeterne mellom korteste og lengste standardlengde, stigende. */
export const halfLengths = (table: PriceTable = PRICE_TABLE): number[] => halfMetreLengths(table);

export type LengthOption = {
  length: number;
  /** Halvmeter: lages på forespørsel, uten listepris. */
  half: boolean;
};

/** Alle lengder som kan velges i kalkulatoren: standardlengder og halvmetere. */
export function lengthOptions(table: PriceTable = PRICE_TABLE): LengthOption[] {
  const standard = [...new Set(table.map((row) => row.length))];
  return [
    ...standard.map((length) => ({ length, half: false })),
    ...halfLengths(table).filter((length) => !standard.includes(length)).map((length) => ({ length, half: true })),
  ].sort((a, b) => a.length - b.length);
}

/**
 * Nærmeste halvmeter over behovet, hvis den er kortere enn den anbefalte
 * standardleideren og ligger mellom korteste og lengste standardlengde.
 */
export function halfStepFor(
  required: number,
  recommended: PriceRow | null,
  table: PriceTable = PRICE_TABLE,
): number | null {
  if (!recommended || !(required > 0)) return null;
  // Regn i hele centimeter, så 4,50 ikke blir 4,5000001 og rundes opp til 5.
  const half = Math.ceil(Math.round(required * 100) / 50) / 2;
  if (Number.isInteger(half) || !isCustomLength(half)) return null;
  if (half >= recommended.length || half <= minLength(table)) return null;
  return half;
}

export function calculate(input: CalcInput, table: PriceTable = PRICE_TABLE): CalcResult {
  const { margin, manual } = waterlineMargin(input);
  const required = requiredLength(input);
  const recommended = rowForRequired(required, table);

  return {
    required,
    margin: round(margin),
    marginManual: manual,
    heelDeg: HEEL_ANGLE_DEG,
    recommended,
    slack: recommended ? round(recommended.length - required) : 0,
    halfStep: halfStepFor(required, recommended, table),
    tooLong: required > maxLength(table),
    atMinimum: required > 0 && recommended?.length === minLength(table),
  };
}
