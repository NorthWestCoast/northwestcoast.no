import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PRICE_TABLE, type PriceRow, type PriceTable } from './pricing';
import { SUPABASE_ANON_KEY, SUPABASE_URL, noteSupabaseMissing, supabaseConfigured } from './supabase/config';

/**
 * Leser prislista fra products-tabellen.
 *
 * Sidene som viser priser er statiske. Tabellen hentes derfor uten cookies
 * (ellers ville sidene blitt dynamiske) og mellomlagres med tag «catalog».
 * Når admin lagrer nye priser kalles revalidateTag(CATALOG_TAG), og sidene
 * bygges på nytt ved neste besøk – ingen deploy nødvendig.
 */
export const CATALOG_TAG = 'catalog';

type ProductRow = {
  id: string;
  product_number: string;
  name: string;
  kind: 'ladder' | 'cabinet' | 'spare_part';
  length_m: number | null;
  steps: number | null;
  price_nok: number;
  price_on_request: boolean;
  cabinet_product_id: string | null;
  active: boolean;
};

const COLUMNS =
  'id, product_number, name, kind, length_m, steps, price_nok, price_on_request, cabinet_product_id, active';

/** Skapmodellen uten «Oppbevaringsskap »-prefikset, f.eks. «ASC-LC3-5». */
const cabinetModel = (name: string) => name.replace(/^Oppbevaringsskap\s+/i, '').trim();

/** Setter sammen leider + tilhørende skap til én rad i prislista. */
export function buildPriceTable(products: ProductRow[]): PriceTable {
  const byId = new Map(products.map((p) => [p.id, p]));

  return products
    .filter((p) => p.kind === 'ladder' && p.active && p.length_m !== null)
    .map((ladder): PriceRow => {
      const cabinet = ladder.cabinet_product_id ? byId.get(ladder.cabinet_product_id) : undefined;
      const usable = cabinet && cabinet.active && !ladder.price_on_request ? cabinet : undefined;

      return {
        productId: ladder.id,
        length: Number(ladder.length_m),
        steps: ladder.steps ?? 0,
        productNumber: ladder.product_number,
        productName: ladder.name,
        price: ladder.price_nok,
        onRequest: ladder.price_on_request || undefined,
        cabinetNumber: usable?.product_number ?? '',
        cabinetName: usable ? cabinetModel(usable.name) : '',
        cabinetPrice: usable?.price_nok ?? 0,
      };
    })
    .sort((a, b) => a.length - b.length);
}

/**
 * Henter prislista med en gitt klient. Kaster ved feil – kallere som kan leve
 * med reserven bruker getPriceTable(); /api/order vil heller feile enn å
 * regne med en annen pris enn den kunden så.
 */
export async function fetchPriceTable(client: SupabaseClient): Promise<PriceTable> {
  const { data, error } = await client.from('products').select(COLUMNS).eq('active', true);
  if (error) throw new Error(`Kunne ikke lese prislista: ${error.message}`);

  const table = buildPriceTable((data ?? []) as ProductRow[]);
  if (table.length === 0) throw new Error('Prislista i databasen er tom.');
  return table;
}

/** Anonym klient uten sesjon. products er åpent lesbart for anon via RLS. */
function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Ikke la et pauset Supabase-prosjekt henge bygget eller sidevisningen.
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
    },
  });
}

const cached = unstable_cache(
  async () => {
    if (!supabaseConfigured) throw new Error('Supabase er ikke konfigurert.');
    return fetchPriceTable(anonClient());
  },
  ['price-table'],
  // Kaster vi, lagres ingenting – reserven blir altså aldri mellomlagret.
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

/** Prislista til sidene. Faller tilbake på den statiske lista ved feil. */
export async function getPriceTable(): Promise<PriceTable> {
  // Uten Supabase er den faste lista det forventede svaret, ikke en feil.
  if (!supabaseConfigured) {
    noteSupabaseMissing();
    return PRICE_TABLE;
  }
  try {
    return await cached();
  } catch (error) {
    console.error('[catalog] Bruker reserveprisliste:', error instanceof Error ? error.message : error);
    return PRICE_TABLE;
  }
}
