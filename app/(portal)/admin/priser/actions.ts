'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { CATALOG_TAG } from '@/lib/catalog';
import { MAX_PRICE, planPriceUpdate, type CurrentProduct } from '@/lib/price-plan';
import { type ActionResult, checked, err, fail, int, ok, optional, text, uuid } from '@/lib/portal/forms';
import { PRODUCT_KINDS } from '@/lib/portal/labels';
import type { Enums } from '@/lib/supabase/database.types';

/** Nettsiden, bestillingsskjemaet og Min side leser katalogen; alle bygges på nytt. */
function refreshCatalog() {
  revalidateTag(CATALOG_TAG);
  revalidatePath('/', 'layout');
}

/**
 * Lagrer prislista. Alle felt kommer fra ett skjema (én «Lagre»-knapp), så en
 * årlig prisjustering kan gjøres i én operasjon. Reglene ligger i
 * lib/price-plan.ts; her skjer bare lesing, skriving og cache-oppdatering.
 *
 * Skriver gjennom administratorens EGEN sesjon: RLS (products_manage) er
 * autorisasjonslaget, ikke denne koden. Prisendringer havner i
 * product_price_history via en trigger.
 */
export async function updatePrices(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const { data, error: readError } = await supabase
    .from('products')
    .select('id, product_number, name, kind, steps, price_nok, price_on_request, active');

  if (readError || !data) return fail(readError, 'Kunne ikke lese produktene. Prøv igjen.');

  const current: CurrentProduct[] = data;
  const plan = planPriceUpdate(current, formData);
  if (!plan.ok) return plan;
  if (plan.patches.size === 0) return ok('Ingen endringer å lagre.');

  const names = new Map(current.map((p) => [p.id, p.name]));
  const failures: string[] = [];
  let saved = 0;

  for (const [id, patch] of plan.patches) {
    const { error } = await supabase.from('products').update(patch).eq('id', id);
    if (error) {
      failures.push(
        error.code === '23505'
          ? `${names.get(id)}: produktnummeret er allerede i bruk.`
          : `${names.get(id)}: ble ikke lagret.`,
      );
      if (error.code !== '23505') console.error('[priser] Lagring feilet:', error.code, error.message);
    } else {
      saved += 1;
    }
  }

  // Selv ved delvis feil: det som ble lagret skal vises på nettsiden.
  if (saved > 0) refreshCatalog();

  if (failures.length > 0) {
    return err(`${saved} lagret, men ${failures.length} feilet: ${failures.join(' ')}`);
  }

  return ok(
    `${saved} ${saved === 1 ? 'endring' : 'endringer'} lagret. Nettsiden og bestillingsskjemaet bruker de nye prisene med en gang.`,
  );
}

const NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/ ]{0,39}$/;

/**
 * Oppretter et produkt. Reglene er de samme som prislista bruker
 * (lib/price-plan.ts), så et nytt produkt aldri hindrer neste prislagring:
 * fast pris krever pris over 0, og for leidere også antall trinn og et
 * offisielt produktnummer. «Pris på forespørsel» finnes bare for leidere.
 */
export async function createProduct(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const kind = text(formData.get('kind'), 20) as Enums<'product_kind'>;
  const number = text(formData.get('product_number'), 40);
  const name = text(formData.get('name'), 160);
  const price = int(formData.get('price_nok'), 0, MAX_PRICE);
  const sortOrder = int(formData.get('sort_order') || '0', 0, 9999);
  const stepsRaw = text(formData.get('steps'), 4);
  const lengthRaw = text(formData.get('length_m'), 6).replace(',', '.');

  if (!(kind in PRODUCT_KINDS)) return err('Velg en type.');
  if (!NUMBER_RE.test(number)) return err('Produktnummeret er ikke gyldig (bokstaver, tall, punktum, bindestrek, inntil 40 tegn).');
  if (name.length < 2) return err('Navn er påkrevd.');
  if (price === null) return err(`Prisen må være hele kroner mellom 0 og ${MAX_PRICE.toLocaleString('nb-NO')}.`);
  if (sortOrder === null) return err('Sorteringen må være et tall fra 0 til 9999.');

  const isLadder = kind === 'ladder';
  const onRequest = isLadder && checked(formData.get('price_on_request'));
  if (!isLadder && checked(formData.get('price_on_request'))) {
    return err('Pris på forespørsel kan bare brukes på leidere. Sett en pris.');
  }
  if (!onRequest && price <= 0) {
    return err(isLadder ? 'Sett en pris, eller huk av for «pris på forespørsel».' : 'Sett en pris.');
  }

  let lengthM: number | null = null;
  let steps: number | null = null;
  let cabinetId: string | null = null;
  if (isLadder) {
    lengthM = /^\d{1,2}(\.\d)?$/.test(lengthRaw) ? Number(lengthRaw) : null;
    if (lengthM === null || lengthM <= 0) return err('Lengden må være et tall i meter, for eksempel 6 eller 6,5.');
    if (stepsRaw) {
      steps = int(stepsRaw, 1, 200);
      if (steps === null) return err('Antall trinn må være et helt tall.');
    }
    if (!onRequest && steps === null) return err('Legg inn antall trinn før du setter fast pris.');
    if (!onRequest && /^ARG-/i.test(number)) {
      return err('Bruk det offisielle produktnummeret når leideren har fast pris. Nummeret vises til kundene.');
    }
    cabinetId = uuid(formData.get('cabinet_product_id'));
  }

  const { error } = await supabase.from('products').insert({
    kind,
    product_number: number,
    name,
    length_m: lengthM,
    steps,
    price_nok: price,
    price_on_request: onRequest,
    cabinet_product_id: cabinetId,
    description: optional(formData.get('description'), 2000),
    sort_order: sortOrder,
  });
  if (error) return error.code === '23505' ? err(`Produktnummeret «${number}» er allerede i bruk.`) : fail(error);

  refreshCatalog();
  return ok(
    kind === 'spare_part'
      ? `${name} er opprettet og kan bestilles på Min side.`
      : `${name} er opprettet.`,
  );
}

/** Navn, beskrivelse, sortering og om produktet er aktivt. Pris endres i prislista. */
export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('product_id'));
  const name = text(formData.get('name'), 160);
  const sortOrder = int(formData.get('sort_order') || '0', 0, 9999);
  const active = checked(formData.get('active'));
  if (!id) return err('Fant ikke produktet.');
  if (name.length < 2) return err('Navn er påkrevd.');
  if (sortOrder === null) return err('Sorteringen må være et tall fra 0 til 9999.');

  if (!active) {
    // Samme vern som i prislista: uten en aktiv leider med fast pris faller
    // nettsiden tilbake på den innebygde reservelista.
    const { data: ladders } = await supabase
      .from('products')
      .select('id')
      .eq('kind', 'ladder')
      .eq('active', true)
      .eq('price_on_request', false)
      .neq('id', id)
      .limit(1);
    const { data: self } = await supabase.from('products').select('kind').eq('id', id).maybeSingle();
    if (self?.kind === 'ladder' && !ladders?.length) {
      return err('Minst én leider må være aktiv og ha fast pris, ellers vises ikke prislista.');
    }
  }

  const { error } = await supabase
    .from('products')
    .update({ name, description: optional(formData.get('description'), 2000), sort_order: sortOrder, active })
    .eq('id', id);
  if (error) return fail(error);

  refreshCatalog();
  return ok(active ? 'Produktet er lagret.' : 'Produktet er lagret og deaktivert. Det vises ikke lenger for kundene.');
}
