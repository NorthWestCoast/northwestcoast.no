'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, int, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';

/** Serviceavtaler. Kunden ser avtalen på Min side; bare administratorer endrer den. */

const STATUSES = ['draft', 'active', 'expired', 'cancelled'];

function refresh(companyId: string) {
  revalidatePath(`/admin/selskap/${companyId}`);
  revalidatePath('/admin/service');
  revalidatePath('/minside', 'layout');
}

type Parsed =
  | { ok: false; error: string }
  | {
      ok: true;
      fields: {
        title: string;
        starts_on: string;
        ends_on: string | null;
        interval_months: number;
        price_nok: number | null;
        covers: string | null;
        notes: string | null;
        status: string;
      };
    };

function parse(formData: FormData): Parsed {
  const title = text(formData.get('title'), 160) || 'Serviceavtale';
  const startsOn = isoDate(formData.get('starts_on'));
  const endsRaw = text(formData.get('ends_on'), 12);
  const endsOn = isoDate(endsRaw);
  const interval = int(formData.get('interval_months'), 1, 120);
  const priceRaw = text(formData.get('price_nok'), 12);
  const price = priceRaw ? int(priceRaw, 0, 10_000_000) : null;
  const status = text(formData.get('status'), 20) || 'active';

  if (!startsOn) return { ok: false, error: 'Velg startdato.' };
  if (endsRaw && !endsOn) return { ok: false, error: 'Sluttdatoen er ikke gyldig.' };
  if (endsOn && endsOn < startsOn) return { ok: false, error: 'Sluttdatoen kan ikke være før startdatoen.' };
  if (interval === null) return { ok: false, error: 'Intervallet må være mellom 1 og 120 måneder.' };
  if (priceRaw && price === null) return { ok: false, error: 'Prisen må være hele kroner.' };
  if (!STATUSES.includes(status)) return { ok: false, error: 'Velg en status.' };

  return {
    ok: true,
    fields: {
      title,
      starts_on: startsOn,
      ends_on: endsOn,
      interval_months: interval,
      price_nok: price,
      covers: optional(formData.get('covers'), 2000),
      notes: optional(formData.get('notes'), 2000),
      status,
    },
  };
}

export async function createAgreement(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();

  const companyId = uuid(formData.get('company_id'));
  if (!companyId) return err('Fant ikke selskapet.');

  const parsed = parse(formData);
  if (!parsed.ok) return err(parsed.error);

  const { error } = await supabase
    .from('service_agreements')
    .insert({ ...parsed.fields, company_id: companyId, created_by: user.id });
  if (error) return fail(error);

  refresh(companyId);
  return ok('Serviceavtalen er opprettet.');
}

export async function updateAgreement(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('agreement_id'));
  if (!id) return err('Fant ikke avtalen.');

  const parsed = parse(formData);
  if (!parsed.ok) return err(parsed.error);

  const { data, error } = await supabase
    .from('service_agreements')
    .update(parsed.fields)
    .eq('id', id)
    .select('company_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Fant ikke avtalen.');

  refresh(data.company_id);
  return ok('Serviceavtalen er oppdatert.');
}

export async function deleteAgreement(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('agreement_id'));
  if (!id) return err('Fant ikke avtalen.');

  const { data, error } = await supabase
    .from('service_agreements')
    .delete()
    .eq('id', id)
    .select('company_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Fant ikke avtalen.');

  refresh(data.company_id);
  return ok('Serviceavtalen er slettet.');
}
