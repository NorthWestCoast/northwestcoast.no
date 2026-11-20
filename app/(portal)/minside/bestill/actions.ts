'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/portal/context';
import {
  type ActionResult, checked, err, fail, int, isEmail, ok, optional, text, uuid,
} from '@/lib/portal/forms';
import { nok } from '@/lib/format';
import { isCustomLength } from '@/lib/pricing';

/** En linje til place_order: et produkt fra katalogen, eller en spesiallengde. */
type OrderItem =
  | { product_id: string; qty: number; with_cabinet: boolean }
  | { custom_length_m: number; qty: number; with_cabinet: boolean };

/**
 * Sender en bestilling fra Min side. Skjemaet sender bare hva og hvor mange;
 * prisene leses fra katalogen i databasen (place_order).
 */
export async function placeOrder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const name = text(formData.get('name'), 120);
  const email = text(formData.get('email'), 160).toLowerCase();
  if (!name) return err('Skriv inn navnet på kontaktpersonen.');
  if (!isEmail(email)) return err('E-postadressen ser ikke gyldig ut.');

  // Produkter fra katalogen: qty_<produkt-id> og cab_<produkt-id>.
  // Halvmetere («Annen lengde»): custom_qty_<n>, custom_length_<n> og custom_cab_<n>.
  const items: OrderItem[] = [];
  for (const [key, value] of formData.entries()) {
    const custom = key.startsWith('custom_qty_');
    if ((!custom && !key.startsWith('qty_')) || !text(value, 12)) continue;

    const qty = int(value, 0, 99);
    if (qty === null) return err('Antall må være et helt tall mellom 0 og 99.');
    if (qty === 0) continue;

    if (custom) {
      const row = key.slice('custom_qty_'.length);
      const length = Number(text(formData.get(`custom_length_${row}`), 8).replace(',', '.'));
      if (!isCustomLength(length)) return err('Velg lengden på leideren under «Annen lengde».');
      items.push({ custom_length_m: length, qty, with_cabinet: checked(formData.get(`custom_cab_${row}`)) });
      continue;
    }

    const productId = uuid(key.slice(4));
    if (!productId) continue;
    items.push({ product_id: productId, qty, with_cabinet: checked(formData.get(`cab_${productId}`)) });
  }
  if (items.length === 0) return err('Velg minst ett produkt ved å fylle inn antall.');
  if (items.length > 30) return err('Bestillingen har for mange linjer. Del den i to.');

  const { data, error } = await supabase.rpc('place_order', {
    payload: {
      name,
      email,
      phone: optional(formData.get('phone'), 40),
      vessel: optional(formData.get('vessel'), 160),
      notes: optional(formData.get('notes'), 4000),
      delivery_address: optional(formData.get('delivery_address'), 400),
      company_id: uuid(formData.get('company_id')),
      source: 'portal',
      items,
    },
  });
  if (error) return fail(error, 'Bestillingen kunne ikke sendes.');

  const result = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const orderNumber = typeof result?.order_number === 'string' ? result.order_number : null;
  const total = typeof result?.total_nok === 'number' ? result.total_nok : null;
  const onRequest =
    Array.isArray(result?.lines) &&
    result.lines.some((line) => line && typeof line === 'object' && !Array.isArray(line) && line.on_request === true);

  revalidatePath('/minside', 'layout');

  return ok(
    [
      orderNumber ? `Bestilling ${orderNumber} er mottatt.` : 'Bestillingen er mottatt.',
      total !== null && total > 0 ? `Sum ${nok(total)} eks. mva.` : null,
      onRequest ? 'Linjer med pris på forespørsel kommer i tillegg; du får tilbud fra oss.' : null,
      'Vi bekrefter bestillingen og gir beskjed om leveringstid.',
    ].filter(Boolean).join(' '),
  );
}
