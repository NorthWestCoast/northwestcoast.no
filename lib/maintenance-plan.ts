/**
 * Vedlikeholdsplanen for Argostep, slik brukermanualen beskriver den.
 *
 * Kilde: «Argostep – Operation and maintenance manual», rev. 7 (23.06.2026),
 * som ligger på /dokumenter/argostep-manual.pdf. Tallene står samlet her så
 * veiledningssiden, llms-filene og senere Min side og påminnelsene bruker de
 * samme. Endres manualen, endres tallene her.
 *
 * ⚠️ Ikke avklart med NorthWestCoast ennå, og derfor IKKE med her:
 * - hvor ofte testen etter ISO 799-1 skal gjentas etter den første (manualen
 *   sier bare «i tjeneste mer enn 30 måneder»);
 * - om serviceintervallet i portalen (ladders.service_interval_months,
 *   standard 12) fortsatt skal gjelde – manualen nevner ingen årlig service.
 */
export const MAINTENANCE_PLAN = {
  /** Kvartalsvis sjekkliste: hver 3. måned. */
  inspectionMonths: 3,
  /** Test etter ISO 799-1 når leideren har vært i tjeneste lenger enn dette. */
  testAfterMonths: 30,
  /** Ordinær garanti. */
  warrantyYears: 2,
  /** Forlenget garanti når oppbevaring, vedlikehold og bruk er fulgt og registrert. */
  extendedWarrantyYears: 5,
  /** Etter disse årene kan garantien forlenges år for år. */
  yearlyWarrantyAfterYears: 7,
  /** Materialene er testet for minst så mange år ved anbefalt oppbevaring. */
  lifetimeYears: 10,
} as const;

/** Brukermanualen som PDF. Bytt fil og tall her når en ny revisjon kommer. */
export const MANUAL = {
  href: '/dokumenter/argostep-manual.pdf',
  revision: 7,
  /** Datoen på forsiden av manualen. */
  date: '2026-06-23',
  /** Filstørrelse i MB, vist ved lenken. */
  sizeMb: 1.4,
  pages: 19,
} as const;

/** Snittegningen fra manualen (side 16), uten den engelske tegnforklaringen. */
export const CONSTRUCTION_DRAWING = {
  src: '/images/argostep-konstruksjon.png',
  width: 756,
  height: 1219,
} as const;
