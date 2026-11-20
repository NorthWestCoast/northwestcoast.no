import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fmtQty, num } from '@/lib/stock';

/**
 * Lesing av lageret, felles for admin og produksjon. Alt går gjennom
 * brukerens egen sesjon, så det er RLS som avgjør hva som kommer tilbake:
 * administratorer og produksjon ser lageret, alle andre får tomme svar.
 */
export type Client = SupabaseClient<Database>;

/** En vare slik oversikten viser den: varen selv pluss bestilt, bundet og tilgjengelig. */
export type StockRow = {
  id: string;
  item_number: string;
  name: string;
  category: string;
  supply: string;
  unit: string;
  product_id: string | null;
  supplier_id: string | null;
  reorder_point: number;
  on_hand: number;
  on_order: number;
  reserved: number;
  available: number;
  below_minimum: boolean;
  location: string | null;
  notes: string | null;
  active: boolean;
};

type OverviewRow = Database['public']['Views']['stock_overview']['Row'];

// Kolonnene i en visning er alltid «kan være null» i de genererte typene.
// Her gjøres de om til det de faktisk er, ett sted.
function toStockRow(row: OverviewRow): StockRow | null {
  if (!row.id) return null;
  return {
    id: row.id,
    item_number: row.item_number ?? '',
    name: row.name ?? '',
    category: row.category ?? 'part',
    supply: row.supply ?? 'purchased',
    unit: row.unit ?? 'stk',
    product_id: row.product_id,
    supplier_id: row.supplier_id,
    reorder_point: num(row.reorder_point),
    on_hand: num(row.on_hand),
    on_order: num(row.on_order),
    reserved: num(row.reserved),
    available: num(row.available),
    below_minimum: row.below_minimum === true,
    location: row.location,
    notes: row.notes,
    active: row.active !== false,
  };
}

/** Hele lageret, sortert på varenummer. Inaktive varer er med; siden velger selv. */
export async function loadStock(supabase: Client): Promise<{ rows: StockRow[]; failed: boolean }> {
  const { data, error } = await supabase.from('stock_overview').select('*').order('item_number').limit(5000);
  if (error) console.error('[lager] Kunne ikke hente lageret:', error.message);
  return { rows: (data ?? []).flatMap((row) => toStockRow(row) ?? []), failed: Boolean(error) };
}

export async function loadStockItem(supabase: Client, id: string): Promise<StockRow | null> {
  const { data, error } = await supabase.from('stock_overview').select('*').eq('id', id).maybeSingle();
  if (error) console.error('[lager] Kunne ikke hente varen:', error.message);
  return data ? toStockRow(data) : null;
}

/** Hele lageret som en ren liste, for sider der varene bare er oppslag og valg i et skjema. */
export const loadStockRows = async (supabase: Client): Promise<StockRow[]> => (await loadStock(supabase)).rows;

/** Bare varene med disse id-ene. Tom liste gir ingen spørring. */
export async function loadStockByIds(supabase: Client, ids: string[]): Promise<StockRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('stock_overview').select('*').in('id', ids);
  if (error) console.error('[lager] Kunne ikke hente lagervarene:', error.message);
  return (data ?? []).flatMap((row) => toStockRow(row) ?? []);
}

/** Varene som selges som disse produktene (ferdig leider, skap). */
export async function loadStockByProducts(supabase: Client, productIds: string[]): Promise<StockRow[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await supabase.from('stock_overview').select('*').in('product_id', productIds);
  if (error) console.error('[lager] Kunne ikke hente lagervarene:', error.message);
  return (data ?? []).flatMap((row) => toStockRow(row) ?? []);
}

/** «DEMO-TAU · Sidetau 20 mm (m)»: slik en vare står i en nedtrekksliste. */
export const itemLabel = (item: { item_number: string; name: string; unit: string }) =>
  `${item.item_number} · ${item.name} (${item.unit})`;

/** Lengden «kan bygges nå» og «behov» regnes for når produktet ikke har fast lengde (spesiallengde). */
export const EXAMPLE_LENGTH_M = 5;

/* ── Utvalg i oversikten ─────────────────────────────────────────────────── */

export const STOCK_VIEWS = {
  alle: 'Alle',
  deler: 'Deler',
  ferdigvarer: 'Ferdigvarer',
  'under-minimum': 'Under minimum',
  'ma-telles': 'Må telles',
} as const;

export type StockView = keyof typeof STOCK_VIEWS;

export const stockView = (value: string | undefined): StockView =>
  (Object.keys(STOCK_VIEWS) as StockView[]).find((key) => key === value) ?? 'alle';

/** Søketekst fra `?q=`. Søket gjøres i minnet, så den trenger bare å være kort og ryddig. */
export const stockQuery = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

export function filterStock(
  rows: StockRow[],
  { view, q, inactive }: { view: StockView; q: string; inactive: boolean },
): StockRow[] {
  const needle = q.toLowerCase();
  return rows.filter((row) => {
    if (!inactive && !row.active) return false;
    if (view === 'deler' && row.category !== 'part') return false;
    if (view === 'ferdigvarer' && row.category !== 'finished') return false;
    if (view === 'under-minimum' && !row.below_minimum) return false;
    if (view === 'ma-telles' && row.on_hand >= 0) return false;
    return !needle || row.item_number.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle);
  });
}

/** Nøkkeltallene øverst i oversikten. Gjelder aktive varer. */
export function summarize(rows: StockRow[]) {
  const active = rows.filter((row) => row.active);
  return {
    items: active.length,
    belowMinimum: active.filter((row) => row.below_minimum).length,
    onOrder: active.filter((row) => row.on_order > 0).length,
    toCount: active.filter((row) => row.on_hand < 0).length,
    inactive: rows.length - active.length,
  };
}

/* ── Forbruk ─────────────────────────────────────────────────────────────── */

/** Hva som har gått hvor i en periode. Alle tall er positive, unntatt `adjusted`. */
export type Usage = {
  received: number;
  produced: number;
  used_in_production: number;
  sold: number;
  scrapped: number;
  returned: number;
  adjusted: number;
};

export const NO_USAGE: Usage = {
  received: 0, produced: 0, used_in_production: 0, sold: 0, scrapped: 0, returned: 0, adjusted: 0,
};

/**
 * Forbruket per vare i en periode, fra stock_usage(). Funksjonen gir bare
 * varer som har hatt bevegelser. Med `itemId` hentes bare den ene varen.
 */
export async function loadUsage(
  supabase: Client,
  period: { from: string | null; to: string | null },
  itemId?: string,
): Promise<{ usage: Map<string, Usage>; failed: boolean }> {
  const args = {
    ...(period.from ? { p_from: period.from } : {}),
    ...(period.to ? { p_to: period.to } : {}),
  };
  const query = supabase.rpc('stock_usage', args);
  const { data, error } = await (itemId ? query.filter('item_id', 'eq', itemId) : query);
  if (error) console.error('[lager] Kunne ikke hente forbruket:', error.message);

  // Typene kjenner ikke radene funksjonen gir (unknown[]), så de leses varsomt.
  const usage = new Map<string, Usage>();
  for (const raw of Array.isArray(data) ? data : []) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.item_id !== 'string') continue;
    usage.set(row.item_id, {
      received: num(row.received),
      produced: num(row.produced),
      used_in_production: num(row.used_in_production),
      sold: num(row.sold),
      scrapped: num(row.scrapped),
      returned: num(row.returned),
      adjusted: num(row.adjusted),
    });
  }
  return { usage, failed: Boolean(error) };
}

/* ── Bevegelser ──────────────────────────────────────────────────────────── */

export type Movement = {
  id: string;
  kind: string;
  quantity: number;
  occurred_on: string;
  created_by_name: string | null;
  note: string | null;
  job_id: string | null;
  order_id: string | null;
  /** Innkjøpet bevegelsen kom fra, når den er et varemottak på en innkjøpslinje. */
  purchase_order_id: string | null;
};

/** De siste bevegelsene på en vare, nyeste først. */
export async function loadMovements(supabase: Client, itemId: string, limit = 100): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, kind, quantity, occurred_on, created_by_name, note, job_id, order_id, purchase_order_lines(purchase_order_id)')
    .eq('item_id', itemId)
    // Datoen bevegelsen gjelder kan være satt tilbake i tid; samme dag sorteres på når den ble ført.
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[lager] Kunne ikke hente bevegelsene:', error.message);

  return (data ?? []).map(({ purchase_order_lines: line, ...movement }) => ({
    ...movement,
    quantity: num(movement.quantity),
    purchase_order_id: line?.purchase_order_id ?? null,
  }));
}

/* ── Åpne innkjøp ────────────────────────────────────────────────────────── */

export type OpenPurchaseLine = {
  id: string;
  purchase_order_id: string;
  po_number: string;
  kind: string;
  supplier: string | null;
  expected_on: string | null;
  ordered: number;
  received: number;
  remaining: number;
};

/** Linjer på åpne innkjøp der ikke alt av varen er kommet. Tidligst ventet først. */
export async function loadOpenPurchaseLines(supabase: Client, itemId: string): Promise<OpenPurchaseLine[]> {
  const { data, error } = await supabase
    .from('purchase_order_lines')
    .select('id, qty_ordered, qty_received, purchase_orders!inner(id, po_number, kind, status, expected_on, suppliers(name))')
    .eq('item_id', itemId)
    .eq('purchase_orders.status', 'ordered');
  if (error) console.error('[lager] Kunne ikke hente åpne innkjøp:', error.message);

  return (data ?? [])
    .map((line) => {
      const ordered = num(line.qty_ordered);
      const received = num(line.qty_received);
      return {
        id: line.id,
        purchase_order_id: line.purchase_orders.id,
        po_number: line.purchase_orders.po_number,
        kind: line.purchase_orders.kind,
        supplier: line.purchase_orders.suppliers?.name ?? null,
        expected_on: line.purchase_orders.expected_on,
        ordered,
        received,
        remaining: Math.round((ordered - received) * 1000) / 1000,
      };
    })
    .filter((line) => line.remaining > 0)
    .sort((a, b) => (a.expected_on ?? '9999').localeCompare(b.expected_on ?? '9999') || a.po_number.localeCompare(b.po_number));
}

/* ── Visning ─────────────────────────────────────────────────────────────── */

/** Mengde med fortegn: «+12 stk» eller «−3 stk». Til bevegelser og justeringer. */
export const signedQty = (value: unknown, unit?: string | null) =>
  `${num(value) > 0 ? '+' : ''}${fmtQty(value, unit)}`;

/** Null vises som en strek, så tallene som betyr noe er lette å se i en tabell. */
export const qtyOrDash = (value: unknown, unit?: string | null) => (num(value) === 0 ? '–' : fmtQty(value, unit));
