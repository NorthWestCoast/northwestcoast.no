'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, ok, optional, text, uuid } from '@/lib/portal/forms';
import { MANUAL_MOVEMENTS, STOCK_CATEGORY, STOCK_SUPPLY, STOCK_UNITS } from '@/lib/portal/labels';
import { parseQty } from '@/lib/stock';
import type { Client } from '@/components/lager/data';
import { postCount, postMovement } from '@/components/lager/register';

/**
 * Lagervarer i admin: opprette, rette og slette varer, og føre bevegelser og
 * varetelling.
 *
 * Alt skrives gjennom administratorens egen sesjon. RLS (app.is_staff()) er
 * autorisasjonslaget, og beholdningen (on_hand) kan ikke skrives herfra: den
 * endres bare av bevegelsene.
 */

const ITEM_NUMBER = /^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/;

/** Alle slagene som føres for hånd. Produksjon har et smalere utvalg. */
const KINDS = MANUAL_MOVEMENTS.map((movement) => movement.kind);

function refresh() {
  // Oversikt, vareside, innkjøp, stykklister og forbruk viser alle beholdningen.
  revalidatePath('/admin/lager', 'layout');
  revalidatePath('/produksjon/lager', 'layout');
}

type ItemInput = {
  item_number: string;
  name: string;
  category: string;
  supply: string;
  unit: string;
  reorder_point: number;
  location: string | null;
  supplier_id: string | null;
  product_id: string | null;
  notes: string | null;
};

/** Feltene fra «Ny vare» og «Rediger vare», kontrollert. */
function readItem(formData: FormData): { error: string } | { error: null; item: ItemInput } {
  const itemNumber = text(formData.get('item_number'), 60);
  if (!ITEM_NUMBER.test(itemNumber)) {
    return { error: 'Varenummeret må være 2–40 tegn: bokstaver, tall, punktum, bindestrek og skråstrek, og begynne med en bokstav eller et tall.' };
  }

  const name = text(formData.get('name'), 160);
  if (name.length < 2) return { error: 'Skriv inn navnet på varen.' };

  const category = text(formData.get('category'), 20);
  if (!Object.keys(STOCK_CATEGORY).includes(category)) return { error: 'Velg kategori.' };
  const supply = text(formData.get('supply'), 20);
  if (!Object.keys(STOCK_SUPPLY).includes(supply)) return { error: 'Velg hvordan varen skaffes.' };
  const unit = STOCK_UNITS.find((value) => value === formData.get('unit'));
  if (!unit) return { error: 'Velg enhet.' };

  // Tomt felt betyr ingen grense.
  const rawMinimum = text(formData.get('reorder_point'), 20);
  const minimum = rawMinimum ? parseQty(rawMinimum) : 0;
  if (minimum === null || minimum < 0) {
    return { error: 'Minimum må være null eller et positivt tall med høyst tre desimaler.' };
  }

  // Et valg som ikke er en gyldig id skal ikke bli til «ingen valgt» i det stille.
  const rawSupplier = text(formData.get('supplier_id'), 40);
  const supplierId = uuid(rawSupplier);
  if (rawSupplier && !supplierId) return { error: 'Leverandøren finnes ikke lenger. Last siden på nytt.' };
  const rawProduct = text(formData.get('product_id'), 40);
  const productId = uuid(rawProduct);
  if (rawProduct && !productId) return { error: 'Produktet finnes ikke lenger. Last siden på nytt.' };

  return {
    error: null,
    item: {
      item_number: itemNumber,
      name,
      category,
      supply,
      unit,
      reorder_point: minimum,
      location: optional(formData.get('location'), 120),
      supplier_id: supplierId,
      product_id: productId,
      notes: optional(formData.get('notes'), 2000),
    },
  };
}

/** Leverandøren og produktet må finnes. Gir feilmeldingen, eller null når alt er i orden. */
async function checkLinks(supabase: Client, item: ItemInput): Promise<string | null> {
  const [supplier, product] = await Promise.all([
    item.supplier_id
      ? supabase.from('suppliers').select('id').eq('id', item.supplier_id).maybeSingle()
      : Promise.resolve({ data: true }),
    item.product_id
      ? supabase.from('products').select('id').eq('id', item.product_id).maybeSingle()
      : Promise.resolve({ data: true }),
  ]);
  if (!supplier.data) return 'Leverandøren finnes ikke lenger. Last siden på nytt.';
  if (!product.data) return 'Produktet finnes ikke lenger. Last siden på nytt.';
  return null;
}

/** Varenummeret og produktet er unike hver for seg; meldingen sier hvilken det gjelder. */
function taken(error: { code?: string; message: string; details?: string | null }): ActionResult | null {
  if (error.code !== '23505') return null;
  return err(/product_id/.test(`${error.message} ${error.details ?? ''}`)
    ? 'Produktet er allerede knyttet til en annen vare.'
    : 'Varenummeret er allerede i bruk på en annen vare.');
}

/** Oppretter en vare og åpner den, så beholdningen kan føres med en telling. */
export async function createItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const parsed = readItem(formData);
  if (parsed.error !== null) return err(parsed.error);
  const linkError = await checkLinks(supabase, parsed.item);
  if (linkError) return err(linkError);

  const { data: created, error } = await supabase.from('stock_items').insert(parsed.item).select('id').single();
  if (error || !created) return (error && taken(error)) ?? fail(error, 'Varen kunne ikke opprettes.');

  refresh();
  redirect(`/admin/lager/${created.id}?ny=1`);
}

export async function updateItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const itemId = uuid(formData.get('item_id'));
  if (!itemId) return err('Fant ikke varen.');

  const parsed = readItem(formData);
  if (parsed.error !== null) return err(parsed.error);
  const linkError = await checkLinks(supabase, parsed.item);
  if (linkError) return err(linkError);

  const { data, error } = await supabase.from('stock_items').update(parsed.item).eq('id', itemId).select('id');
  if (error) return taken(error) ?? fail(error);
  // RLS filtrerer bort rader man ikke kan endre, uten å gi feil.
  if (!data?.length) return err('Fant ikke varen, eller du har ikke tilgang til å endre den.');

  refresh();
  return ok('Varen er lagret.');
}

/** Tar varen ut av oversikten, eller inn igjen. Bevegelsene og stykklistene står som de er. */
export async function setItemActive(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const itemId = uuid(formData.get('item_id'));
  if (!itemId) return err('Fant ikke varen.');
  const active = formData.get('active') === 'true';

  const { data, error } = await supabase.from('stock_items').update({ active }).eq('id', itemId).select('id');
  if (error) return fail(error);
  if (!data?.length) return err('Fant ikke varen, eller du har ikke tilgang til å endre den.');

  refresh();
  return ok(active ? 'Varen er aktiv igjen.' : 'Varen er satt som inaktiv.');
}

/**
 * Sletter en vare som aldri har vært i bruk. Har den bevegelser, står den i
 * en stykkliste eller på et innkjøp, nekter databasen (fremmednøkkel), og da
 * er rådet å sette den som inaktiv.
 */
export async function deleteItem(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const itemId = uuid(formData.get('item_id'));
  if (!itemId) return err('Fant ikke varen.');

  const { data, error } = await supabase.from('stock_items').delete().eq('id', itemId).select('id');
  if (error) {
    // 23503 er brudd på fremmednøkkel. Nyere PostgreSQL (fra 18) gir 23001 når
    // nøkkelen er satt til «restrict», som her, så begge betyr det samme.
    return error.code === '23503' || error.code === '23001'
      ? err('Varen er i bruk og kan ikke slettes. Sett den som inaktiv i stedet.')
      : fail(error);
  }
  if (!data?.length) return err('Fant ikke varen, eller du har ikke tilgang til å slette den.');

  refresh();
  redirect('/admin/lager?slettet=1');
}

/** Varemottak, svinn, solgt direkte eller retur, ført for hånd. */
export async function registerMovement(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const result = await postMovement(supabase, formData, KINDS);
  if (result.ok) refresh();
  return result;
}

/** Varetelling: forskjellen mot beholdningen føres som én justering. */
export async function registerCount(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const result = await postCount(supabase, formData);
  if (result.ok) refresh();
  return result;
}
