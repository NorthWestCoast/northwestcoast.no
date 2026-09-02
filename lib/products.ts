/**
 * The Argostep price/variant table.
 *
 * Previously this lived inside the (client-side) order configurator, which meant
 * the numbers were unreachable from server components. It now sits in lib/ so
 * three consumers can share one table:
 *   1. components/order-configurator.tsx – the interactive basket
 *   2. components/ladder-calculator.tsx  – the /leiderkalkulator tool
 *   3. lib/structured-data.ts            – Product/ProductGroup JSON-LD
 *
 * Keeping the schema.org offers generated from the same rows the UI renders is
 * what keeps the site out of Google's "price mismatch" penalty box, and it is
 * what lets an answer engine quote a correct price for a specific length.
 */

export type LadderRow = {
  /** Nominal ladder length in metres. */
  length: number;
  /** Number of steps on that length. */
  steps: number;
  productNumber: string;
  productName: string;
  /** Indicative price in NOK, excluding VAT. */
  price: number;
  cabinetNumber: string;
  cabinetName: string;
  cabinetPrice: number;
};

export const PRICE_TABLE: LadderRow[] = [
  { length: 3,  steps: 10, productNumber: '400-031', productName: 'Argostep – 3ML',  price: 9499,  cabinetNumber: '400-061', cabinetName: 'ASC-LC3-5',   cabinetPrice: 9000 },
  { length: 4,  steps: 13, productNumber: '400-032', productName: 'Argostep – 4ML',  price: 10999, cabinetNumber: '400-062', cabinetName: 'ASC-LC3-5',   cabinetPrice: 9000 },
  { length: 5,  steps: 16, productNumber: '400-033', productName: 'Argostep – 5ML',  price: 12499, cabinetNumber: '400-063', cabinetName: 'ASC-LC3-5',   cabinetPrice: 9000 },
  { length: 6,  steps: 19, productNumber: '400-034', productName: 'Argostep – 6ML',  price: 13999, cabinetNumber: '400-065', cabinetName: 'ASC-LC5-6',   cabinetPrice: 9500 },
  { length: 7,  steps: 22, productNumber: '400-035', productName: 'Argostep – 7ML',  price: 15499, cabinetNumber: '400-062', cabinetName: 'ASC-LC6-8',   cabinetPrice: 10000 },
  { length: 8,  steps: 25, productNumber: '400-036', productName: 'Argostep – 8ML',  price: 16999, cabinetNumber: '400-063', cabinetName: 'ASC-LC6-8',   cabinetPrice: 10000 },
  { length: 9,  steps: 28, productNumber: '400-037', productName: 'Argostep – 9ML',  price: 18099, cabinetNumber: '400-063', cabinetName: 'ASC-LC9-10',  cabinetPrice: 11000 },
  { length: 10, steps: 31, productNumber: '400-038', productName: 'Argostep – 10ML', price: 20699, cabinetNumber: '400-064', cabinetName: 'ASC-LC9-10',  cabinetPrice: 11000 },
  { length: 11, steps: 34, productNumber: '400-039', productName: 'Argostep – 11ML', price: 23499, cabinetNumber: '400-064', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 12, steps: 37, productNumber: '400-040', productName: 'Argostep – 12ML', price: 25999, cabinetNumber: '400-065', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 13, steps: 40, productNumber: '400-041', productName: 'Argostep – 13ML', price: 27499, cabinetNumber: '400-066', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 14, steps: 43, productNumber: '400-042', productName: 'Argostep – 14ML', price: 28999, cabinetNumber: '400-067', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
  { length: 15, steps: 46, productNumber: '400-043', productName: 'Argostep – 15ML', price: 30599, cabinetNumber: '400-068', cabinetName: 'ASC-LC11-16', cabinetPrice: 12000 },
];

export const LENGTHS = PRICE_TABLE.map((r) => r.length);
export const MIN_LENGTH = LENGTHS[0];
export const MAX_LENGTH = LENGTHS[LENGTHS.length - 1];

export const PRICE_MIN = Math.min(...PRICE_TABLE.map((r) => r.price));
export const PRICE_MAX = Math.max(...PRICE_TABLE.map((r) => r.price));

/** Currency for every price on the site. */
export const CURRENCY = 'NOK';

/** Norwegian number formatting (1 234 rather than 1,234). */
export const fmt = (n: number) => n.toLocaleString('nb-NO');

/** Row for an exact standard length, falling back to the shortest ladder. */
export const rowFor = (length: number): LadderRow =>
  PRICE_TABLE.find((r) => r.length === length) ?? PRICE_TABLE[0];

/**
 * Smallest standard ladder that is at least `metres` long.
 * Returns undefined when the requirement exceeds the longest standard ladder –
 * the calculator then routes the user to a custom quote instead of silently
 * recommending something too short.
 */
export const smallestFitting = (metres: number): LadderRow | undefined =>
  PRICE_TABLE.find((r) => r.length >= metres);
