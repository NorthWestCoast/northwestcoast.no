import { PRICE_TABLE, type PriceRow } from './pricing';

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
 * Standard tillegg under vannlinjen, i meter.
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

export const MIN_LENGTH = PRICE_TABLE[0].length;
export const MAX_LENGTH = PRICE_TABLE[PRICE_TABLE.length - 1].length;

export type CalcInput = {
  /** Fribord: loddrett høyde fra vannlinjen til innstigningsdekket, i meter. */
  freeboard: number;
  /** Høyde fra dekket opp til festepunktet (rekke, skansekledning), i meter. */
  mountHeight: number;
  /** Tillegg under vannlinjen, i meter. */
  margin: number;
};

export type CalcResult = {
  /** Summen brukeren må dekke, i meter. */
  required: number;
  /** Korteste standardleider som dekker behovet, eller null hvis over maks. */
  recommended: PriceRow | null;
  /** Hvor mye lengre den anbefalte leideren er enn behovet, i meter. */
  slack: number;
  /** Behovet er større enn lengste standardleider. */
  tooLong: boolean;
  /** Behovet dekkes av den korteste leideren i sortimentet. */
  atMinimum: boolean;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function requiredLength({ freeboard, mountHeight, margin }: CalcInput): number {
  const sum = (freeboard || 0) + (mountHeight || 0) + (margin || 0);
  return round(Math.max(0, sum));
}

export function rowForRequired(required: number): PriceRow | null {
  return PRICE_TABLE.find((row) => row.length >= required) ?? null;
}

export function calculate(input: CalcInput): CalcResult {
  const required = requiredLength(input);
  const recommended = rowForRequired(required);

  return {
    required,
    recommended,
    slack: recommended ? round(recommended.length - required) : 0,
    tooLong: required > MAX_LENGTH,
    atMinimum: required > 0 && recommended?.length === MIN_LENGTH,
  };
}
