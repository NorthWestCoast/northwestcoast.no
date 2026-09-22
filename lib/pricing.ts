/**
 * Priser iht. offisiell tabell. Skap-navn/-nummer og -pris følger lengden.
 *
 * Denne modulen deles av konfiguratoren (klient) og /api/order (server).
 * Serveren regner alltid ut prisen på nytt fra denne tabellen – klienten
 * sender kun lengde, antall og om skap er valgt, aldri kronebeløp.
 *
 * MERK – prisene finnes også i products-tabellen i Supabase. Denne filen er
 * fasit for det kunden får se og betale, fordi /bestill er en statisk side
 * som ikke skal gjøre et databasekall for å vise en pris. products-tabellen
 * er speilet, og brukes til å knytte ordrelinjer til ekte produktrader.
 * /api/order logger en feil hvis de to har drevet fra hverandre.
 */
export type PriceRow = {
  length: number;
  steps: number;
  productNumber: string;
  productName: string;
  price: number;
  cabinetNumber: string;
  cabinetName: string;
  cabinetPrice: number;
};

export const PRICE_TABLE: PriceRow[] = [
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

export const MIN_PRICE = Math.min(...PRICE_TABLE.map((r) => r.price));
export const MAX_PRICE = Math.max(...PRICE_TABLE.map((r) => r.price));

/** Én linje i bestillingen, slik klienten sender den. Aldri med pris. */
export type OrderLine = {
  length: number;
  qty: number;
  cabinet: boolean;
};

export const fmt = (n: number) => n.toLocaleString('nb-NO');

export function rowFor(length: number): PriceRow {
  return PRICE_TABLE.find((r) => r.length === length) ?? PRICE_TABLE[0];
}

/** Enhetspris (leider + evt. skap) for en gitt lengde. */
export function unitPrice(length: number, cabinet: boolean): number {
  const row = rowFor(length);
  return row.price + (cabinet ? row.cabinetPrice : 0);
}

export function lineTotal(line: OrderLine): number {
  return unitPrice(line.length, line.cabinet) * line.qty;
}

export function orderTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}
