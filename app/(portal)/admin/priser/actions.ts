'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { CATALOG_TAG } from '@/lib/catalog';
import { planPriceUpdate, type CurrentProduct } from '@/lib/price-plan';
import type { ActionResult } from '@/components/action-form';

/**
 * Lagrer prislista. Alle felt kommer fra ett skjema (én «Lagre»-knapp), så en
 * årlig prisjustering kan gjøres i én operasjon. Reglene ligger i
 * lib/price-plan.ts; her skjer bare lesing, skriving og cache-oppdatering.
 *
 * Skriver gjennom den ansattes EGEN sesjon: RLS (products_manage) er
 * autorisasjonslaget, ikke denne koden. Prisendringer havner i
 * product_price_history via en trigger.
 */
export async function updatePrices(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const { data, error: readError } = await supabase
    .from('products')
    .select('id, product_number, name, kind, steps, price_nok, price_on_request, active');

  if (readError || !data) {
    return { ok: false, error: `Kunne ikke lese produktene: ${readError?.message ?? 'ukjent feil'}` };
  }

  const current = data as CurrentProduct[];
  const plan = planPriceUpdate(current, formData);
  if (!plan.ok) return plan;
  if (plan.patches.size === 0) return { ok: true, message: 'Ingen endringer å lagre.' };

  const names = new Map(current.map((p) => [p.id, p.name]));
  const failures: string[] = [];
  let saved = 0;

  for (const [id, patch] of plan.patches) {
    const { error } = await supabase.from('products').update(patch).eq('id', id);
    if (error) {
      failures.push(
        error.code === '23505'
          ? `${names.get(id)}: produktnummeret er allerede i bruk.`
          : `${names.get(id)}: ${error.message}`,
      );
    } else {
      saved += 1;
    }
  }

  // Selv ved delvis feil: det som ble lagret skal vises på nettsiden.
  if (saved > 0) {
    revalidateTag(CATALOG_TAG);
    revalidatePath('/', 'layout');
  }

  if (failures.length > 0) {
    return {
      ok: false,
      error: `${saved} lagret, men ${failures.length} feilet: ${failures.join(' ')}`,
    };
  }

  return {
    ok: true,
    message: `${saved} ${saved === 1 ? 'endring' : 'endringer'} lagret. Nettsiden og bestillingsskjemaet bruker de nye prisene med en gang.`,
  };
}
