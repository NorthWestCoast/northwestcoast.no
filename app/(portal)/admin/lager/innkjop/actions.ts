'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, checked, err, fail, isEmail, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { PURCHASE_KIND } from '@/lib/portal/labels';
import { fmtQty, num, parseQty } from '@/lib/stock';
import { idag } from '@/lib/format';

/**
 * Innkjøp og leverandører i admin.
 *
 * Alt skrives med administratorens egen sesjon; RLS (app.is_staff()) er
 * autorisasjonslaget. Varemottak går gjennom receive_purchase_line(), som
 * fører bevegelsen, teller opp linja og setter innkjøpet som mottatt når alt
 * er kommet. Beholdningen skrives aldri herfra.
 */

const MAX_LINES = 100;

type Staff = Awaited<ReturnType<typeof requireStaff>>;

function refresh(orderId?: string) {
  // Oversikten, varesidene og stykklistene viser «bestilt» og beholdning.
  revalidatePath('/admin/lager', 'layout');
  revalidatePath('/produksjon', 'layout');
  if (orderId) revalidatePath(`/admin/lager/innkjop/${orderId}`);
}

/** Mengde større enn null, eller null når feltet ikke holder mål. */
function positiveQty(value: FormDataEntryValue | null): number | null {
  const qty = parseQty(value);
  return qty !== null && qty > 0 ? qty : null;
}

type SupplierValues = {
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
};

/** Leser leverandørfeltene. `prefix` skiller dem fra innkjøpets egne felt. */
function readSupplier(formData: FormData, prefix = ''): { error: string } | { error: null; values: SupplierValues } {
  const name = text(formData.get(`${prefix}name`), 160);
  if (name.length < 2) return { error: 'Skriv inn navnet på leverandøren.' };
  const email = optional(formData.get(`${prefix}email`), 200);
  if (email && !isEmail(email)) return { error: 'E-postadressen til leverandøren er ikke gyldig.' };
  return {
    error: null,
    values: {
      name,
      contact_name: optional(formData.get(`${prefix}contact_name`), 160),
      email,
      phone: optional(formData.get(`${prefix}phone`), 40),
    },
  };
}

/* ── Leverandører ────────────────────────────────────────────────────────── */

/** Oppretter en leverandør, eller lagrer endringer på en som finnes. */
export async function saveSupplier(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const rawId = text(formData.get('supplier_id'), 40);
  const id = uuid(rawId);
  if (rawId && !id) return err('Fant ikke leverandøren.');

  const parsed = readSupplier(formData);
  if (parsed.error !== null) return err(parsed.error);
  const notes = optional(formData.get('notes'), 2000);

  // To leverandører med samme navn kan ikke skilles i nedtrekkslista.
  const sameName = await supplierByName(supabase, parsed.values.name);
  if (sameName && sameName !== id) {
    return err(`Det finnes allerede en leverandør som heter ${parsed.values.name}.`);
  }

  if (!id) {
    const { error } = await supabase.from('suppliers').insert({ ...parsed.values, notes });
    if (error) return fail(error, 'Leverandøren kunne ikke lagres.');
    refresh();
    return ok(`${parsed.values.name} er lagt til.`);
  }

  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...parsed.values, notes, active: checked(formData.get('active')) })
    .eq('id', id)
    .select('id');
  if (error) return fail(error, 'Leverandøren kunne ikke lagres.');
  if (!data?.length) return err('Fant ikke leverandøren.');

  refresh();
  return ok('Leverandøren er lagret.');
}

/**
 * Id-en til leverandøren med dette navnet, uavhengig av store og små
 * bokstaver. Lista er kort, så den sammenlignes her framfor med et mønster i
 * spørringen, der tegn i navnet kunne blitt lest som jokertegn.
 */
async function supplierByName(supabase: Staff['supabase'], name: string): Promise<string | null> {
  const { data } = await supabase.from('suppliers').select('id, name').limit(5000);
  const wanted = name.toLocaleLowerCase('nb');
  return (data ?? []).find((row) => row.name.trim().toLocaleLowerCase('nb') === wanted)?.id ?? null;
}

/* ── Nytt innkjøp ────────────────────────────────────────────────────────── */

type LineInput = { item_id: string; qty_ordered: number };

/**
 * Leser linjene fra skjemaet: feltene `item` og `qty` kommer parvis, én gang
 * per linje. En vare kan bare stå på én linje (unik i databasen), så
 * dobbeltføringer avvises med navnet på varen i stedet for en databasefeil.
 */
function readLines(formData: FormData): { error: string } | { error: null; lines: LineInput[] } {
  const items = formData.getAll('item');
  const qtys = formData.getAll('qty');
  if (items.length !== qtys.length || items.length > MAX_LINES) {
    return { error: 'Linjene kunne ikke leses. Last siden på nytt og prøv igjen.' };
  }

  const lines: LineInput[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const rawItem = text(items[index], 40);
    const rawQty = text(qtys[index], 20);
    // En tom linje nederst er ikke en feil.
    if (!rawItem && !rawQty) continue;

    const itemId = uuid(rawItem);
    if (!itemId) return { error: `Linje ${index + 1}: velg en vare.` };
    const qty = positiveQty(rawQty);
    if (qty === null) {
      return { error: `Linje ${index + 1}: mengden må være et tall større enn null, med høyst tre desimaler.` };
    }
    lines.push({ item_id: itemId, qty_ordered: qty });
  }

  if (lines.length === 0) return { error: 'Legg til minst én linje med vare og mengde.' };
  return { error: null, lines };
}

/**
 * Oppretter et innkjøp med linjer. Leverandøren velges fra lista, eller
 * legges inn som ny i samme skjema.
 *
 * Alt valideres før noe skrives. Rekkefølgen etterpå er leverandør, innkjøp,
 * linjer; feiler linjene, slettes innkjøpet igjen, så det ikke blir stående
 * et tomt innkjøp.
 */
export async function createPurchase(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const kind = text(formData.get('kind'), 40);
  if (!Object.hasOwn(PURCHASE_KIND, kind)) return err('Velg hva slags innkjøp dette er.');

  const today = idag();
  const orderedOn = isoDate(formData.get('ordered_on')) ?? today;
  if (orderedOn > today) return err('Bestillingsdatoen kan ikke ligge fram i tid.');
  const rawExpected = text(formData.get('expected_on'), 12);
  const expectedOn = isoDate(rawExpected);
  if (rawExpected && !expectedOn) return err('Ventet dato er ikke en gyldig dato.');
  if (expectedOn && expectedOn < orderedOn) return err('Ventet dato kan ikke være før bestillingsdatoen.');

  const supplierChoice = text(formData.get('supplier'), 40);
  const newSupplier = supplierChoice === 'new' ? readSupplier(formData, 'supplier_') : null;
  if (newSupplier && newSupplier.error !== null) return err(newSupplier.error);
  const existingSupplier = uuid(supplierChoice);
  if (!newSupplier && !existingSupplier) return err('Velg en leverandør.');

  const parsed = readLines(formData);
  if (parsed.error !== null) return err(parsed.error);

  const itemIds = parsed.lines.map((line) => line.item_id);
  const { data: items, error: itemError } = await supabase
    .from('stock_items')
    .select('id, item_number')
    .in('id', itemIds);
  if (itemError) return fail(itemError);
  const numberById = new Map((items ?? []).map((item) => [item.id, item.item_number]));
  if (itemIds.some((id) => !numberById.has(id))) return err('En av varene finnes ikke lenger. Last siden på nytt.');

  const seen = new Set<string>();
  for (const id of itemIds) {
    if (seen.has(id)) return err(`${numberById.get(id)} står på flere linjer. Slå dem sammen til én linje.`);
    seen.add(id);
  }

  let supplierId = existingSupplier;
  if (newSupplier && newSupplier.error === null) {
    // Finnes navnet fra før, brukes den leverandøren. Da gir et nytt forsøk
    // etter en feil lenger ned ikke to like leverandører.
    const sameName = await supplierByName(supabase, newSupplier.values.name);
    if (sameName) {
      supplierId = sameName;
    } else {
      const { data: created, error } = await supabase
        .from('suppliers')
        .insert(newSupplier.values)
        .select('id')
        .single();
      if (error || !created) return fail(error, 'Leverandøren kunne ikke lagres.');
      supplierId = created.id;
    }
  } else {
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('id', existingSupplier as string).maybeSingle();
    if (!supplier) return err('Leverandøren finnes ikke lenger. Last siden på nytt.');
  }

  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id: supplierId,
      kind,
      ordered_on: orderedOn,
      expected_on: expectedOn,
      reference: optional(formData.get('reference'), 120),
      notes: optional(formData.get('notes'), 2000),
    })
    .select('id')
    .single();
  if (orderError || !order) return fail(orderError, 'Innkjøpet kunne ikke opprettes.');

  const { error: lineError } = await supabase
    .from('purchase_order_lines')
    .insert(parsed.lines.map((line) => ({ ...line, purchase_order_id: order.id })));
  if (lineError) {
    await supabase.from('purchase_orders').delete().eq('id', order.id);
    return fail(lineError, 'Linjene kunne ikke lagres. Innkjøpet er ikke opprettet.');
  }

  refresh();
  redirect(`/admin/lager/innkjop/${order.id}`);
}

/* ── Ett innkjøp ─────────────────────────────────────────────────────────── */

/** Ventet dato, leverandørens referanse og notat. Bare mens innkjøpet er åpent. */
export async function updatePurchase(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  if (!orderId) return err('Fant ikke innkjøpet.');

  const rawExpected = text(formData.get('expected_on'), 12);
  const expectedOn = isoDate(rawExpected);
  if (rawExpected && !expectedOn) return err('Ventet dato er ikke en gyldig dato.');

  const { data: order } = await supabase
    .from('purchase_orders')
    .select('id, status, ordered_on')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return err('Fant ikke innkjøpet.');
  if (order.status !== 'ordered') return err('Innkjøpet er avsluttet og kan ikke endres.');
  if (expectedOn && expectedOn < order.ordered_on) return err('Ventet dato kan ikke være før bestillingsdatoen.');

  const { data, error } = await supabase
    .from('purchase_orders')
    .update({
      expected_on: expectedOn,
      reference: optional(formData.get('reference'), 120),
      notes: optional(formData.get('notes'), 2000),
    })
    .eq('id', orderId)
    .eq('status', 'ordered')
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Innkjøpet er avsluttet og kan ikke endres.');

  refresh(orderId);
  return ok('Innkjøpet er oppdatert.');
}

/**
 * Kansellerer et åpent innkjøp. Det som alt er mottatt, er ført som
 * bevegelser og blir stående på lager; bare resten slutter å telle som bestilt.
 */
export async function cancelPurchase(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  if (!orderId) return err('Fant ikke innkjøpet.');

  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('status', 'ordered')
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Innkjøpet er allerede mottatt eller kansellert.');

  refresh(orderId);
  return ok('Innkjøpet er kansellert.');
}

/** Varemottak på én linje. Kan gjøres i flere omganger. */
export async function receiveLine(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const lineId = uuid(formData.get('line_id'));
  if (!lineId) return err('Fant ikke linja.');
  const qty = positiveQty(formData.get('qty'));
  if (qty === null) return err('Mengden må være et tall større enn null, med høyst tre desimaler.');

  const today = idag();
  const rawDate = text(formData.get('received_on'), 12);
  const receivedOn = isoDate(rawDate);
  if (rawDate && !receivedOn) return err('Mottaksdatoen er ikke en gyldig dato.');
  if (receivedOn && receivedOn > today) return err('Mottaksdatoen kan ikke ligge fram i tid.');
  const note = optional(formData.get('note'), 500);

  const { data: line } = await supabase
    .from('purchase_order_lines')
    .select('id, purchase_order_id, qty_ordered, qty_received, stock_items(unit)')
    .eq('id', lineId)
    .maybeSingle();
  if (!line) return err('Fant ikke linja.');

  const { error } = await supabase.rpc('receive_purchase_line', {
    p_line: lineId,
    p_qty: qty,
    p_received_on: receivedOn ?? today,
    ...(note ? { p_note: note } : {}),
  });
  if (error) return fail(error, 'Mottaket kunne ikke registreres.');

  refresh(line.purchase_order_id);

  const unit = line.stock_items?.unit ?? null;
  const over = Math.round((num(line.qty_received) + qty - num(line.qty_ordered)) * 1000) / 1000;
  const { data: order } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', line.purchase_order_id)
    .maybeSingle();

  return ok([
    `Mottatt ${fmtQty(qty, unit)}`,
    over > 0 ? `, ${fmtQty(over, unit)} mer enn bestilt` : '',
    '.',
    order?.status === 'received' ? ' Alt er kommet, og innkjøpet er satt som mottatt.' : '',
  ].join(''));
}

/**
 * Linja og innkjøpet den hører til, når linja fortsatt kan endres: innkjøpet
 * er åpent og ingenting er mottatt på linja.
 */
async function editableLine(
  supabase: Staff['supabase'],
  lineId: string,
): Promise<{ error: string } | { error: null; orderId: string }> {
  const { data: line } = await supabase
    .from('purchase_order_lines')
    .select('id, purchase_order_id, qty_received, purchase_orders(status)')
    .eq('id', lineId)
    .maybeSingle();
  if (!line) return { error: 'Fant ikke linja.' };
  if (line.purchase_orders?.status !== 'ordered') return { error: 'Innkjøpet er avsluttet og kan ikke endres.' };
  if (num(line.qty_received) > 0) return { error: 'Det er allerede mottatt varer på linja, så den kan ikke endres.' };
  return { error: null, orderId: line.purchase_order_id };
}

/** Bestilt mengde og notat på en linje der ingenting er mottatt. */
export async function updateLine(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const lineId = uuid(formData.get('line_id'));
  if (!lineId) return err('Fant ikke linja.');
  const qty = positiveQty(formData.get('qty_ordered'));
  if (qty === null) return err('Mengden må være et tall større enn null, med høyst tre desimaler.');

  const line = await editableLine(supabase, lineId);
  if (line.error !== null) return err(line.error);

  // qty_received = 0 også i selve endringen: et mottak kan ha kommet imellom.
  const { data, error } = await supabase
    .from('purchase_order_lines')
    .update({ qty_ordered: qty, note: optional(formData.get('note'), 500) })
    .eq('id', lineId)
    .eq('qty_received', 0)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Det er allerede mottatt varer på linja, så den kan ikke endres.');

  refresh(line.orderId);
  return ok('Linja er oppdatert.');
}

/** Ny linje på et åpent innkjøp. */
export async function addLine(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  if (!orderId) return err('Fant ikke innkjøpet.');
  const itemId = uuid(formData.get('item'));
  if (!itemId) return err('Velg en vare.');
  const qty = positiveQty(formData.get('qty'));
  if (qty === null) return err('Mengden må være et tall større enn null, med høyst tre desimaler.');

  const [{ data: order }, { data: item }] = await Promise.all([
    supabase.from('purchase_orders').select('id, status').eq('id', orderId).maybeSingle(),
    supabase.from('stock_items').select('id, item_number').eq('id', itemId).maybeSingle(),
  ]);
  if (!order) return err('Fant ikke innkjøpet.');
  if (order.status !== 'ordered') return err('Innkjøpet er avsluttet og kan ikke endres.');
  if (!item) return err('Varen finnes ikke lenger. Last siden på nytt.');

  const { error } = await supabase.from('purchase_order_lines').insert({
    purchase_order_id: orderId,
    item_id: itemId,
    qty_ordered: qty,
    note: optional(formData.get('note'), 500),
  });
  if (error) {
    return error.code === '23505'
      ? err(`${item.item_number} står allerede på innkjøpet. Endre mengden på den linja i stedet.`)
      : fail(error);
  }

  refresh(orderId);
  return ok(`${item.item_number} er lagt til.`);
}

/**
 * Fjerner en linje der ingenting er mottatt. Er resten av innkjøpet kommet,
 * er det dermed komplett og settes som mottatt.
 */
export async function removeLine(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const lineId = uuid(formData.get('line_id'));
  if (!lineId) return err('Fant ikke linja.');

  const line = await editableLine(supabase, lineId);
  if (line.error !== null) return err(line.error);

  const { data: others } = await supabase
    .from('purchase_order_lines')
    .select('id, qty_ordered, qty_received')
    .eq('purchase_order_id', line.orderId)
    .neq('id', lineId);
  if (!others?.length) return err('Innkjøpet må ha minst én linje. Kanseller innkjøpet i stedet.');

  const { data, error } = await supabase
    .from('purchase_order_lines')
    .delete()
    .eq('id', lineId)
    .eq('qty_received', 0)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Det er allerede mottatt varer på linja, så den kan ikke fjernes.');

  let completed = false;
  if (others.every((other) => num(other.qty_received) >= num(other.qty_ordered))) {
    const { data: closed } = await supabase
      .from('purchase_orders')
      .update({ status: 'received' })
      .eq('id', line.orderId)
      .eq('status', 'ordered')
      .select('id');
    completed = Boolean(closed?.length);
  }

  refresh(line.orderId);
  return ok(completed
    ? 'Linja er fjernet. Resten er mottatt, så innkjøpet er satt som mottatt.'
    : 'Linja er fjernet.');
}
