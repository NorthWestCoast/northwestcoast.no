// Priser iht. offisiell tabell. Skap-navn/-nummer og -pris følger lengden.
// Delt mellom bestillingskonfiguratoren og /api/order, slik at summen som
// sendes til oss alltid regnes ut på nytt på serveren.
export type PriceRow = {
  length: number;
  steps: number;
  productNumber: string;
  productName: string;
  price: number;
  cabinetNumber: string;
  cabinetName: string;
  cabinetPrice: number;
  /** Ingen fast pris ennå – bestillingen går som prisforespørsel. */
  onRequest?: boolean;
};

export const PRICE_TABLE: PriceRow[] = [
  // 2 m er i sortimentet, men vi har ikke fastsatt pris eller produktnummer.
  // Fyll inn her når de finnes – onRequest kan da fjernes.
  { length: 2,  steps: 0,  productNumber: '',        productName: 'Argostep – 2ML',  price: 0,     cabinetNumber: '',        cabinetName: '',            cabinetPrice: 0, onRequest: true },
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

export const LENGTHS = PRICE_TABLE.map((r) => r.length); // 3..15

export const fmt = (n: number) => n.toLocaleString('nb-NO');

export const rowFor = (length: number) =>
  PRICE_TABLE.find((r) => r.length === length) ?? PRICE_TABLE[0];

/** Enhetspris inkl. valgfritt skap. Prisforespørsler teller som 0 i summer. */
export const unitPrice = (row: PriceRow, cabinet: boolean) =>
  row.onRequest ? 0 : row.price + (cabinet ? row.cabinetPrice : 0);
