/**
 * The maths behind /leiderkalkulator.
 *
 * Kept as pure functions in lib/ rather than inside the React component for two
 * reasons: the page's HowTo/JSON-LD needs the same constants the UI shows, and a
 * pure function is the part worth testing if this ever grows.
 *
 * The model is deliberately simple and fully transparent — every term is shown
 * to the user in the result breakdown. A calculator that hides its arithmetic is
 * useless to a skipper who has to defend the choice to an inspector, and it is
 * also worthless as citable content for an answer engine.
 */

import { MAX_LENGTH, smallestFitting, type LadderRow } from './products';

/**
 * Length "lost" at the top of the ladder: the section consumed by securing it
 * to the rail, deck eye or ladder box before the first usable step. A fixed
 * allowance rather than an input — it varies little in practice, and one more
 * field would cost more clarity than it buys accuracy.
 */
export const ATTACHMENT_ALLOWANCE_M = 0.3;

/**
 * Typical tidal range by Norwegian coastal stretch, in metres.
 *
 * Norway's tidal range grows sharply northwards — a few decimetres in the Oslo
 * fjord against roughly two and a half metres in Troms and Finnmark. A ladder
 * dimensioned for high water in Bodø is a ladder that stops a metre and a half
 * short at low water, so the region is an input rather than a constant.
 *
 * These are rounded typical values for dimensioning only. Exact tidal data for a
 * specific harbour comes from Kartverket (sehavniva.no).
 */
export const TIDE_PRESETS = [
  { id: 'oslofjord', label: 'Oslofjorden og Skagerrak', tide: 0.4 },
  { id: 'vestlandet', label: 'Vestlandet (Stavanger–Bergen)', tide: 1.2 },
  { id: 'midt', label: 'Møre, Trøndelag og Helgeland', tide: 1.8 },
  { id: 'nord', label: 'Nordland, Troms og Finnmark', tide: 2.5 },
  { id: 'custom', label: 'Jeg vet tidevannsforskjellen selv', tide: 1.0 },
] as const;

export type TideId = (typeof TIDE_PRESETS)[number]['id'];

export type CalcInput = {
  /** Metres from the waterline to the ladder's fixing point, as the vessel lies today. */
  fixingHeight: number;
  /** Extra freeboard when the vessel is at its lightest draught (empty/ballast). */
  lightCondition: number;
  /** Tidal range to allow for, in metres. */
  tide: number;
  /** Extra allowance for swell and vessel movement, in metres. */
  seaState: number;
};

export type CalcResult = {
  /** Every term that goes into the total, in the order they are displayed. */
  terms: { label: string; value: number; hint: string }[];
  /** Minimum ladder length in metres, before rounding to a standard size. */
  required: number;
  /** Smallest standard Argostep that covers `required`, if one exists. */
  recommended?: LadderRow;
  /** True when the requirement exceeds the longest standard ladder. */
  overMax: boolean;
  /** Slack in metres between the recommended standard length and the requirement. */
  surplus: number;
};

/** Rounds to one decimal, avoiding 0.30000000000000004 in the UI. */
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Formats metres with a Norwegian decimal comma ("6,6 m", not "6.6 m").
 *
 * Done with a string replace rather than toLocaleString on purpose: this value
 * is rendered both on the server and in the browser, and any locale/ICU
 * difference between the two would produce a React hydration mismatch.
 */
export const metres = (n: number) => n.toFixed(1).replace('.', ',');

export function calculate(input: CalcInput): CalcResult {
  const terms = [
    {
      label: 'Høyde fra vannlinje til innfesting',
      value: round1(input.fixingHeight),
      hint: 'Målt slik fartøyet ligger i dag.',
    },
    {
      label: 'Tillegg for letteste lastkondisjon',
      value: round1(input.lightCondition),
      hint: 'Fribordet øker når fartøyet går tomt eller i ballast.',
    },
    {
      label: 'Tidevannsforskjell',
      value: round1(input.tide),
      hint: 'Ved lavvann er det lengre ned til vannflaten.',
    },
    {
      label: 'Margin for sjøgang og fartøybevegelse',
      value: round1(input.seaState),
      hint: 'Slingring og bølgehøyde gjør at leideren må nå litt lenger.',
    },
    {
      label: 'Festetillegg i innfestingen',
      value: ATTACHMENT_ALLOWANCE_M,
      hint: 'Lengden som går med til å sikre leideren i topp.',
    },
  ];

  const required = round1(terms.reduce((sum, t) => sum + t.value, 0));
  const recommended = smallestFitting(required);

  return {
    terms,
    required,
    recommended,
    overMax: required > MAX_LENGTH,
    surplus: recommended ? round1(recommended.length - required) : 0,
  };
}
