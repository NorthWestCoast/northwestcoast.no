'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/portal/context';
import {
  type ActionResult, checked, err, fail, isEmail, ok, optional, text, uuid,
} from '@/lib/portal/forms';

function refresh() {
  revalidatePath('/minside', 'layout');
}

/** Brukerens egne opplysninger. E-posten følger innloggingen og kan ikke endres her. */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: optional(formData.get('full_name'), 120),
      phone: optional(formData.get('phone'), 40),
      title: optional(formData.get('title'), 120),
      notify_email: checked(formData.get('notify_email')),
    })
    .eq('user_id', ctx.userId)
    .select('user_id');
  if (error) return fail(error, 'Profilen kunne ikke lagres.');
  if (!data?.length) return err('Fant ikke profilen din. Last siden på nytt og prøv igjen.');

  refresh();
  return ok('Profilen er lagret.');
}

/** Selskapets kontaktopplysninger. Krever eier- eller administratorrolle. */
export async function updateCompany(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const companyId = uuid(formData.get('company_id'));
  if (!companyId) return err('Fant ikke selskapet.');

  const name = text(formData.get('name'), 160);
  if (name.length < 2) return err('Skriv inn navnet på selskapet.');

  const contactEmail = optional(formData.get('contact_email'), 160)?.toLowerCase() ?? null;
  if (contactEmail && !isEmail(contactEmail)) return err('E-postadressen til kontaktpersonen ser ikke gyldig ut.');

  const { data, error } = await supabase
    .from('companies')
    .update({
      name,
      address: optional(formData.get('address')),
      postal_code: optional(formData.get('postal_code'), 10),
      city: optional(formData.get('city'), 80),
      contact_name: optional(formData.get('contact_name'), 120),
      contact_email: contactEmail,
      contact_phone: optional(formData.get('contact_phone'), 40),
    })
    .eq('id', companyId)
    .select('id');
  if (error) return fail(error, 'Opplysningene kunne ikke lagres.');
  // RLS filtrerer bort raden framfor å kaste feil når man mangler rettigheter.
  if (!data?.length) return err('Bare eiere og administratorer kan endre selskapets opplysninger.');

  refresh();
  return ok('Opplysningene er lagret.');
}
