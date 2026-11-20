import { type ActionResult, err, fail, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { MANUAL_MOVEMENTS } from '@/lib/portal/labels';
import { fmtQty, num, parseQty } from '@/lib/stock';
import { idag } from '@/lib/format';
import { type Client, signedQty } from './data';

/**
 * Registrering av bevegelser og varetelling, felles for admin og produksjon.
 *
 * Disse funksjonene er ikke server actions og har ingen vokter. De kalles fra
 * actions.ts i hvert område, som først har sjekket rollen, og de får den
 * innloggede brukerens klient, så RLS gjelder uansett.
 *
 * Skjemaet sender alltid en positiv mengde og et slag. Fortegnet settes her.
 */

export type ManualKind = (typeof MANUAL_MOVEMENTS)[number]['kind'];

/**
 * Verdien i «Hva har skjedd» når varemottaket gjelder en linje på et åpent
 * innkjøp: «innkjop:<linjens id>». Da føres mottaket på innkjøpet
 * (receive_purchase_line), så «i bestilling» går ned samtidig som beholdningen
 * går opp.
 */
export const PURCHASE_PREFIX = 'innkjop:';

const QTY_HELP = 'Bruk et tall med høyst tre desimaler.';

/** Beholdningen etter en registrering, til kvitteringen. Null hvis den ikke kunne leses. */
async function onHandNow(supabase: Client, itemId: string): Promise<number | null> {
  const { data } = await supabase.from('stock_items').select('on_hand').eq('id', itemId).maybeSingle();
  return data ? num(data.on_hand) : null;
}

/**
 * Fører én bevegelse for hånd: varemottak, svinn, solgt direkte eller retur.
 * `allowed` er slagene området får registrere.
 */
export async function postMovement(
  supabase: Client,
  formData: FormData,
  allowed: readonly ManualKind[],
): Promise<ActionResult> {
  const itemId = uuid(formData.get('item_id'));
  if (!itemId) return err('Fant ikke varen.');

  const rawKind = text(formData.get('kind'), 60);
  const purchaseLine = rawKind.startsWith(PURCHASE_PREFIX) ? uuid(rawKind.slice(PURCHASE_PREFIX.length)) : null;
  const movement = MANUAL_MOVEMENTS.find(
    (candidate) => candidate.kind === (purchaseLine ? 'receipt' : rawKind) && allowed.includes(candidate.kind),
  );
  if (!movement) return err('Velg hva som har skjedd.');

  const qty = parseQty(formData.get('quantity'));
  if (qty === null || qty <= 0) return err(`Skriv inn en mengde større enn null. ${QTY_HELP}`);

  const today = idag();
  const rawDate = text(formData.get('occurred_on'), 12);
  const date = rawDate ? isoDate(rawDate) : today;
  if (!date) return err('Datoen er ikke gyldig.');
  if (date > today) return err('Datoen kan ikke ligge fram i tid.');

  const note = optional(formData.get('note'), 500);

  const { data: item } = await supabase.from('stock_items').select('id, unit').eq('id', itemId).maybeSingle();
  if (!item) return err('Fant ikke varen.');

  if (purchaseLine) {
    // Linja må gjelde denne varen. Ellers kunne et skjema for én vare føre
    // mottak på en annen.
    const { data: line } = await supabase
      .from('purchase_order_lines')
      .select('id, item_id')
      .eq('id', purchaseLine)
      .maybeSingle();
    if (!line || line.item_id !== item.id) return err('Fant ikke innkjøpet. Last siden på nytt.');

    const { error } = await supabase.rpc('receive_purchase_line', {
      p_line: line.id,
      p_qty: qty,
      p_received_on: date,
      ...(note ? { p_note: note } : {}),
    });
    if (error) return fail(error, 'Varemottaket kunne ikke registreres.');
  } else {
    const { error } = await supabase.from('stock_movements').insert({
      item_id: item.id,
      quantity: movement.sign * qty,
      kind: movement.kind,
      note,
      occurred_on: date,
    });
    if (error) return fail(error, 'Bevegelsen kunne ikke registreres.');
  }

  const after = await onHandNow(supabase, item.id);
  const receipt = `${movement.label}: ${fmtQty(qty, item.unit)}.`;
  return ok(after === null ? receipt : `${receipt} På lager nå: ${fmtQty(after, item.unit)}.`);
}

/**
 * Varetelling. Brukeren oppgir det som ble talt; her leses beholdningen slik
 * den står, og forskjellen føres som ÉN justering. Stemmer tellingen, føres
 * ingenting.
 */
export async function postCount(supabase: Client, formData: FormData): Promise<ActionResult> {
  const itemId = uuid(formData.get('item_id'));
  if (!itemId) return err('Fant ikke varen.');

  const counted = parseQty(formData.get('counted'));
  if (counted === null || counted < 0) return err(`Skriv inn det som ble talt, fra null og opp. ${QTY_HELP}`);

  const { data: item } = await supabase.from('stock_items').select('id, unit, on_hand').eq('id', itemId).maybeSingle();
  if (!item) return err('Fant ikke varen.');

  const before = num(item.on_hand);
  // Tre desimaler, som kolonnen. Uten avrunding gir 0,3 − 0,1 en «forskjell» som ikke finnes.
  const difference = Math.round((counted - before) * 1000) / 1000;
  if (difference === 0) {
    return ok(`Tellingen stemmer: ${fmtQty(counted, item.unit)}. Ingenting er endret.`);
  }

  const remark = optional(formData.get('note'), 300);
  const { error } = await supabase.from('stock_movements').insert({
    item_id: item.id,
    quantity: difference,
    kind: 'adjustment',
    note: [`Talt ${fmtQty(counted, item.unit)}, sto som ${fmtQty(before, item.unit)}.`, remark].filter(Boolean).join(' '),
    occurred_on: idag(),
  });
  if (error) return fail(error, 'Tellingen kunne ikke registreres.');

  // Beholdningen leses og rettes i to steg. Kom det en annen bevegelse
  // imellom, stemmer ikke resultatet med tellingen, og det skal brukeren vite.
  const after = await onHandNow(supabase, item.id);
  if (after !== null && after !== counted) {
    return ok(
      `Tellingen er ført (${signedQty(difference, item.unit)}), men beholdningen ble endret samtidig og står nå som ${fmtQty(after, item.unit)}. Tell på nytt hvis det ikke stemmer.`,
    );
  }
  return ok(`Tellingen er ført: ${fmtQty(counted, item.unit)} (${signedQty(difference, item.unit)}).`);
}
