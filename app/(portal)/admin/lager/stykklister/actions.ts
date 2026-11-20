'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, ok, optional, text, uuid } from '@/lib/portal/forms';
import { PRODUCT_SOURCING } from '@/lib/portal/labels';
import { parseQty } from '@/lib/stock';

/**
 * Stykklister i admin: hvordan et produkt skaffes, hvilken lagervare det
 * selges som, og hvilke deler det består av.
 *
 * Alt skrives med administratorens egen sesjon (RLS: app.is_staff()).
 * Databasen trekker delene selv når en jobb blir ferdig; her vedlikeholdes
 * bare oppskriften den følger.
 */

function refresh(productId: string) {
  revalidatePath('/admin/lager', 'layout');
  revalidatePath(`/admin/lager/stykklister/${productId}`);
  // Jobbsidene viser delene til jobben, og tavla hva som står på lager.
  revalidatePath('/produksjon', 'layout');
}

type Staff = Awaited<ReturnType<typeof requireStaff>>;

/** Produktet, eller null når id-en ikke finnes. */
async function findProduct(supabase: Staff['supabase'], productId: string) {
  const { data } = await supabase
    .from('products')
    .select('id, kind, name, product_number, sourcing')
    .eq('id', productId)
    .maybeSingle();
  return data;
}

/** Lagervarens forsyning som svarer til hvordan produktet skaffes. */
const supplyFor = (sourcing: string) => (sourcing === 'resale' ? 'purchased' : 'assembled');

/* ── Slik skaffes produktet ──────────────────────────────────────────────── */

/**
 * Bytter mellom «bygges selv» og «videresalg». Lagervaren for det ferdige
 * produktet følger med, så den ikke står som «settes sammen hos oss» for noe
 * som kjøpes ferdig.
 */
export async function setSourcing(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  if (!productId) return err('Fant ikke produktet.');
  const sourcing = text(formData.get('sourcing'), 20);
  if (!Object.hasOwn(PRODUCT_SOURCING, sourcing)) return err('Velg hvordan produktet skaffes.');

  const { data, error } = await supabase
    .from('products')
    .update({ sourcing })
    .eq('id', productId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke produktet.');

  // Bare mellom «kjøpes ferdig» og «settes sammen hos oss». «Produseres
  // eksternt» røres ikke: det er et bevisst valg på varen.
  await supabase
    .from('stock_items')
    .update({ supply: supplyFor(sourcing) })
    .eq('product_id', productId)
    .eq('supply', sourcing === 'resale' ? 'assembled' : 'purchased');

  refresh(productId);
  return ok(sourcing === 'resale'
    ? 'Produktet står som videresalg. Ingen deler trekkes når en jobb blir ferdig.'
    : 'Produktet står som bygget selv. Delene i stykklista trekkes når en jobb blir ferdig.');
}

/* ── Lagervare for det ferdige produktet ─────────────────────────────────── */

/** Varenummer bygget på produktnummeret, innenfor det kolonnen godtar. */
function itemNumberFrom(productNumber: string, suffix = ''): string {
  const cleaned = productNumber.trim().replace(/[^A-Za-z0-9._/-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  const base = cleaned.length >= 2 ? cleaned : `P-${cleaned}`.padEnd(3, '0');
  return `${base.slice(0, 40 - suffix.length)}${suffix}`;
}

/**
 * Oppretter lagervaren som teller ferdige enheter av produktet. Varen får
 * samme nummer som produktet; er det opptatt av en annen vare, får den
 * «-F» bak.
 */
export async function createFinishedItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  if (!productId) return err('Fant ikke produktet.');
  const product = await findProduct(supabase, productId);
  if (!product) return err('Fant ikke produktet.');

  const { data: existing } = await supabase.from('stock_items').select('id').eq('product_id', productId).maybeSingle();
  if (existing) return err('Produktet har allerede en lagervare.');

  const values = {
    name: product.name,
    // En reservedel er en del også når den selges; leidere og skap er ferdigvarer.
    category: product.kind === 'spare_part' ? 'part' : 'finished',
    supply: supplyFor(product.sourcing),
    unit: 'stk',
    product_id: productId,
  };

  for (const suffix of ['', '-F']) {
    const itemNumber = itemNumberFrom(product.product_number, suffix);
    const { error } = await supabase.from('stock_items').insert({ ...values, item_number: itemNumber });
    if (!error) {
      refresh(productId);
      return ok(`Lagervaren ${itemNumber} er opprettet. Beholdningen er 0 til noe er ført inn.`);
    }
    // 23505 på varenummeret: prøv neste. Alt annet er en reell feil.
    if (error.code !== '23505' || !/item_number/.test(error.message)) return fail(error, 'Lagervaren kunne ikke opprettes.');
  }

  return err(`Varenummeret ${itemNumberFrom(product.product_number)} er opptatt. Opprett varen under Lager, og koble den til her.`);
}

/** Kobler produktet til en lagervare som finnes fra før og ikke hører til et annet produkt. */
export async function linkItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  if (!productId) return err('Fant ikke produktet.');
  const itemId = uuid(formData.get('item'));
  if (!itemId) return err('Velg en lagervare.');

  const [product, { data: item }, { data: component }] = await Promise.all([
    findProduct(supabase, productId),
    supabase.from('stock_items').select('id, item_number, product_id').eq('id', itemId).maybeSingle(),
    supabase.from('product_components').select('id').eq('product_id', productId).eq('item_id', itemId).maybeSingle(),
  ]);
  if (!product) return err('Fant ikke produktet.');
  if (!item) return err('Varen finnes ikke lenger. Last siden på nytt.');
  if (item.product_id && item.product_id !== productId) return err(`${item.item_number} hører allerede til et annet produkt.`);
  if (component) return err(`${item.item_number} står i stykklista til produktet og kan ikke være det ferdige produktet også.`);

  const { data, error } = await supabase
    .from('stock_items')
    .update({ product_id: productId })
    .eq('id', itemId)
    .is('product_id', null)
    .select('id');
  if (error) {
    return error.code === '23505' ? err('Produktet har allerede en lagervare. Fjern koblingen først.') : fail(error);
  }
  if (!data?.length) return err(`${item.item_number} er allerede koblet til et produkt.`);

  refresh(productId);
  return ok(`${item.item_number} teller nå ferdige enheter av produktet.`);
}

/** Fjerner koblingen. Varen og beholdningen blir stående; den hører bare ikke til produktet lenger. */
export async function unlinkItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  if (!productId) return err('Fant ikke produktet.');

  const { data, error } = await supabase
    .from('stock_items')
    .update({ product_id: null })
    .eq('product_id', productId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Produktet har ingen lagervare.');

  refresh(productId);
  return ok('Koblingen er fjernet. Varen finnes fortsatt på lager.');
}

/* ── Stykklista ──────────────────────────────────────────────────────────── */

/**
 * Mengdene på en linje: fast per enhet og per meter leider. Tomt felt er 0.
 * Minst én av dem må være større enn null (samme regel som i databasen).
 */
function readQuantities(formData: FormData): { error: string } | { error: null; qty: number; qtyPerMetre: number } {
  const read = (name: string) => {
    const raw = text(formData.get(name), 20);
    return raw ? parseQty(raw) : 0;
  };
  const qty = read('qty');
  const qtyPerMetre = read('qty_per_metre');
  if (qty === null || qtyPerMetre === null || qty < 0 || qtyPerMetre < 0) {
    return { error: 'Mengdene må være tall som ikke er negative, med høyst tre desimaler.' };
  }
  if (qty === 0 && qtyPerMetre === 0) {
    return { error: 'Fyll inn mengde per enhet, mengde per meter eller begge.' };
  }
  return { error: null, qty, qtyPerMetre };
}

/** Legger en del til i stykklista. */
export async function addComponent(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  if (!productId) return err('Fant ikke produktet.');
  const itemId = uuid(formData.get('item'));
  if (!itemId) return err('Velg en del.');
  const quantities = readQuantities(formData);
  if (quantities.error !== null) return err(quantities.error);

  const [product, { data: item }] = await Promise.all([
    findProduct(supabase, productId),
    supabase.from('stock_items').select('id, item_number, product_id').eq('id', itemId).maybeSingle(),
  ]);
  if (!product) return err('Fant ikke produktet.');
  if (!item) return err('Varen finnes ikke lenger. Last siden på nytt.');
  // Ellers ville en ferdig jobb både trukket og lagt til den samme varen.
  if (item.product_id === productId) return err(`${item.item_number} er det ferdige produktet og kan ikke være en del av seg selv.`);

  const { error } = await supabase.from('product_components').insert({
    product_id: productId,
    item_id: itemId,
    qty: quantities.qty,
    qty_per_metre: quantities.qtyPerMetre,
    note: optional(formData.get('note'), 500),
  });
  if (error) {
    return error.code === '23505'
      ? err(`${item.item_number} står allerede i stykklista. Endre mengden på den linja i stedet.`)
      : fail(error);
  }

  refresh(productId);
  return ok(`${item.item_number} er lagt til i stykklista.`);
}

/** Endrer mengder og notat på en linje i stykklista. */
export async function updateComponent(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  const componentId = uuid(formData.get('component_id'));
  if (!productId || !componentId) return err('Fant ikke linja.');
  const quantities = readQuantities(formData);
  if (quantities.error !== null) return err(quantities.error);

  const { data, error } = await supabase
    .from('product_components')
    .update({ qty: quantities.qty, qty_per_metre: quantities.qtyPerMetre, note: optional(formData.get('note'), 500) })
    .eq('id', componentId)
    // Produktet også: en id fra et annet produkt skal ikke kunne endres herfra.
    .eq('product_id', productId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke linja. Last siden på nytt.');

  refresh(productId);
  return ok('Linja er lagret.');
}

/** Fjerner en del fra stykklista. */
export async function removeComponent(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  const componentId = uuid(formData.get('component_id'));
  if (!productId || !componentId) return err('Fant ikke linja.');

  const { data, error } = await supabase
    .from('product_components')
    .delete()
    .eq('id', componentId)
    .eq('product_id', productId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke linja. Last siden på nytt.');

  refresh(productId);
  return ok('Delen er fjernet fra stykklista.');
}

/**
 * Kopierer stykklista fra et annet produkt. Bare deler som mangler her legges
 * til; linjer som alt står i stykklista, endres ikke. Slik kan en nesten lik
 * lengde kopieres uten at noe som er rettet for hånd går tapt.
 */
export async function copyComponents(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  if (!productId) return err('Fant ikke produktet.');
  const sourceId = uuid(formData.get('source'));
  if (!sourceId) return err('Velg produktet det skal kopieres fra.');
  if (sourceId === productId) return err('Velg et annet produkt enn dette.');

  const [product, source, { data: sourceRows, error: sourceError }, { data: ownRows }, { data: ownItem }] =
    await Promise.all([
      findProduct(supabase, productId),
      findProduct(supabase, sourceId),
      supabase.from('product_components').select('item_id, qty, qty_per_metre, note').eq('product_id', sourceId),
      supabase.from('product_components').select('item_id').eq('product_id', productId),
      supabase.from('stock_items').select('id').eq('product_id', productId).maybeSingle(),
    ]);
  if (sourceError) return fail(sourceError);
  if (!product || !source) return err('Fant ikke produktet.');
  if (!sourceRows?.length) return err(`${source.name} har ingen stykkliste å kopiere.`);

  const have = new Set((ownRows ?? []).map((row) => row.item_id));
  const kept = sourceRows.filter((row) => have.has(row.item_id)).length;
  // Produktets egen lagervare kan ikke være en del av seg selv.
  const missing = sourceRows.filter((row) => !have.has(row.item_id) && row.item_id !== ownItem?.id);

  if (missing.length === 0) return ok('Alle delene står allerede i stykklista. Ingenting er endret.');

  const { error } = await supabase
    .from('product_components')
    .insert(missing.map((row) => ({ ...row, product_id: productId })));
  if (error) return fail(error, 'Stykklista kunne ikke kopieres.');

  refresh(productId);
  return ok([
    missing.length === 1 ? `La til 1 del fra ${source.name}.` : `La til ${missing.length} deler fra ${source.name}.`,
    kept > 0 ? `${kept} sto her fra før og er ikke endret.` : '',
  ].filter(Boolean).join(' '));
}
