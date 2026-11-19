'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/portal/context';
import {
  type ActionResult, checked, err, fail, int, isEmail, ok, optional, text, uuid,
} from '@/lib/portal/forms';
import { nok } from '@/lib/format';

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

  // Feltene heter qty_<produkt-id> og cab_<produkt-id>.
  const items: { product_id: string; qty: number; with_cabinet: boolean }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('qty_') || !text(value, 12)) continue;
    const productId = uuid(key.slice(4));
    if (!productId) continue;

    const qty = int(value, 0, 99);
    if (qty === null) return err('Antall må være et helt tall mellom 0 og 99.');
    if (qty === 0) continue;

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
      onRequest ? 'Varer med pris på forespørsel kommer i tillegg; du får tilbud fra oss.' : null,
      'Vi bekrefter bestillingen og gir beskjed om leveringstid.',
    ].filter(Boolean).join(' '),
  );
}
