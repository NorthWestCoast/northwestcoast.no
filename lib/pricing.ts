/**
 * Prislogikk for konfigurator, kalkulator og /api/order.
 *
 * KILDE: products-tabellen i Supabase er fasit, og NWC vedlikeholder den selv
 * i /admin/priser. lib/catalog.ts leser den og gir sidene en PriceTable.
 *
 * PRICE_TABLE under er bare RESERVEN: den brukes når databasen ikke svarer
 * eller ikke er konfigurert (lokal utvikling, nedetid), slik at nettsiden
 * aldri står uten prisliste. Den gjengir prislista som NWC har gjennomgått.
 * Endringer gjøres i admin – ikke her – så det ikke finnes to sannheter.
 *
 * Serveren regner alltid ut prisen på nytt: klienten sender kun lengde,
 * antall og om skap er valgt, aldri kronebeløp.
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
  /** Ingen fast pris ennå – går som prisforespørsel og teller ikke i summer. */
  onRequest?: boolean;
  /** products.id for leideren. Finnes bare når raden kommer fra databasen. */
  productId?: string;
};

export type PriceTable = PriceRow[];

export const PRICE_TABLE: PriceRow[] = [
  // 2 m er i sortimentet, men pris og produktnummer er ikke fastsatt. Fyll inn
  // her (og legg produktet i products-tabellen) når de finnes, og fjern onRequest.
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

const PRICED = (table: PriceTable) => table.filter((r) => !r.onRequest);

export const lengthsOf = (table: PriceTable = PRICE_TABLE) => table.map((r) => r.length);
export const minPrice = (table: PriceTable = PRICE_TABLE) =>
  Math.min(...PRICED(table).map((r) => r.price));
export const maxPrice = (table: PriceTable = PRICE_TABLE) =>
  Math.max(...PRICED(table).map((r) => r.price));

/** Én linje i bestillingen, slik klienten sender den. Aldri med pris. */
export type OrderLine = {
  length: number;
  qty: number;
  cabinet: boolean;
};

export const fmt = (n: number) => n.toLocaleString('nb-NO');

export function rowFor(length: number, table: PriceTable = PRICE_TABLE): PriceRow {
  return table.find((r) => r.length === length) ?? PRICED(table)[0] ?? table[0];
}

/** Kan denne raden bestilles med oppbevaringsskap? */
export const cabinetAvailable = (row: PriceRow) => !row.onRequest && Boolean(row.cabinetName);

/** Enhetspris (leider + evt. skap) for en gitt lengde. */
export function unitPrice(length: number, cabinet: boolean, table: PriceTable = PRICE_TABLE): number {
  const row = rowFor(length, table);
  if (row.onRequest) return 0;
  return row.price + (cabinet && cabinetAvailable(row) ? row.cabinetPrice : 0);
}

export function lineTotal(line: OrderLine, table: PriceTable = PRICE_TABLE): number {
  return unitPrice(line.length, line.cabinet, table) * line.qty;
}

export function orderTotal(lines: OrderLine[], table: PriceTable = PRICE_TABLE): number {
  return lines.reduce((sum, line) => sum + lineTotal(line, table), 0);
}

/**
 * Binder alle hjelperne til én tabell. Klientkomponentene får tabellen som
 * prop fra serveren (lest fra databasen) og bruker denne i stedet for å
 * importere den statiske lista.
 */
export function makePricing(table: PriceTable) {
  return {
    table,
    lengths: lengthsOf(table),
    rowFor: (length: number) => rowFor(length, table),
    unitPrice: (length: number, cabinet: boolean) => unitPrice(length, cabinet, table),
    lineTotal: (line: OrderLine) => lineTotal(line, table),
    orderTotal: (lines: OrderLine[]) => orderTotal(lines, table),
  };
}
