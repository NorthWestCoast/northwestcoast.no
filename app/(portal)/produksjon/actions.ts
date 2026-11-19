'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireProduction } from '@/lib/portal/context';
import {
  type ActionResult,
  checked,
  err,
  fail,
  isoDate,
  ok,
  optional,
  text,
  uuid,
} from '@/lib/portal/forms';

/**
 * Handlinger i produksjonsområdet.
 *
 * Alt som flytter en jobb går gjennom funksjonene i databasen
 * (set_production_step, assign_job_serial, advance_job), som selv avgjør hvem
 * som har lov og holder bestilling, leider og varsler i takt. Vokteren her er
 * bare for å svare ryddig; det er databasen som beskytter.
 */

const refresh = () => revalidatePath('/produksjon', 'layout');

/** Kvitterer ut et steg, eller angrer kvitteringen. */
export async function setStep(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireProduction();

  const step = uuid(formData.get('step'));
  if (!step) return err('Fant ikke steget.');
  const done = formData.get('done') === 'true';
  const note = optional(formData.get('note'), 1000);

  const { data, error } = await supabase.rpc('set_production_step', {
    p_step: step,
    p_done: done,
    ...(note ? { p_note: note } : {}),
  });
  if (error) return fail(error);

  refresh();
  const status = data && typeof data === 'object' && !Array.isArray(data) ? data.status : null;
  if (!done) return ok('Kvitteringen er angret.');
  return ok(status === 'ready'
    ? 'Alle steg er kvittert ut. Jobben er klar for forsendelse.'
    : 'Steget er kvittert ut.');
}

/** Registrerer (eller retter) produksjonsnummeret. Leideren opprettes i databasen. */
export async function assignSerial(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireProduction();

  const job = uuid(formData.get('job'));
  if (!job) return err('Fant ikke jobben.');
  const serial = text(formData.get('serial'), 40);
  if (!serial) return err('Skriv inn produksjonsnummeret.');

  const { error } = await supabase.rpc('assign_job_serial', { p_job: job, p_serial: serial });
  if (error) return fail(error);

  refresh();
  return ok('Produksjonsnummeret er registrert.');
}

/** Marker jobben som sendt, med transportør og sporingsnummer. */
export async function shipJob(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireProduction();

  const job = uuid(formData.get('job'));
  if (!job) return err('Fant ikke jobben.');
  const carrier = optional(formData.get('carrier'), 120);
  const tracking = optional(formData.get('tracking'), 120);

  const { error } = await supabase.rpc('advance_job', {
    p_job: job,
    p_status: 'shipped',
    ...(carrier ? { p_carrier: carrier } : {}),
    ...(tracking ? { p_tracking: tracking } : {}),
  });
  if (error) return fail(error);

  refresh();
  return ok('Jobben er markert som sendt.');
}

/** Marker jobben som levert. Leideren får status levert hos kunden. */
export async function deliverJob(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireProduction();

  const job = uuid(formData.get('job'));
  if (!job) return err('Fant ikke jobben.');

  const { error } = await supabase.rpc('advance_job', { p_job: job, p_status: 'delivered' });
  if (error) return fail(error);

  refresh();
  return ok('Jobben er markert som levert.');
}

/** Kansellerer jobben. Bare administratorer. */
export async function cancelJob(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin('/produksjon');

  const job = uuid(formData.get('job'));
  if (!job) return err('Fant ikke jobben.');

  const { error } = await supabase.rpc('advance_job', { p_job: job, p_status: 'cancelled' });
  if (error) return fail(error);

  refresh();
  return ok('Jobben er kansellert.');
}

/** Retter frist og spesielle krav på en jobb. Bare administratorer. */
export async function updateJob(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin('/produksjon');

  const job = uuid(formData.get('job'));
  if (!job) return err('Fant ikke jobben.');

  const rawDue = text(formData.get('due_date'), 12);
  const due = isoDate(rawDue);
  if (rawDue && !due) return err('Fristen er ikke en gyldig dato.');

  const { data, error } = await supabase
    .from('production_jobs')
    .update({ due_date: due, spec_notes: optional(formData.get('spec_notes'), 2000) })
    .eq('id', job)
    .select('id');
  if (error) return fail(error);
  // RLS filtrerer bort rader man ikke kan endre, uten å gi feil.
  if (!data?.length) return err('Fant ikke jobben, eller du har ikke tilgang til å endre den.');

  refresh();
  return ok('Jobben er oppdatert.');
}

/**
 * Oppretter en jobb som ikke kommer fra en bestilling (lager, garanti,
 * avtale på telefon). Spesifikasjonen kopieres fra produktet her og nå, og
 * stegene legges til av en trigger i databasen.
 */
export async function createJob(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin('/produksjon/ny');

  const productId = uuid(formData.get('product'));
  if (!productId) return err('Velg et produkt.');
  const customer = text(formData.get('customer_label'), 160);
  if (customer.length < 2) return err('Skriv inn kundenavn.');

  const rawDue = text(formData.get('due_date'), 12);
  const due = isoDate(rawDue);
  if (rawDue && !due) return err('Fristen er ikke en gyldig dato.');

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, product_number, length_m, steps, cabinet_product_id')
    .eq('id', productId)
    .eq('kind', 'ladder')
    .eq('active', true)
    .maybeSingle();
  if (productError) return fail(productError);
  if (!product) return err('Produktet finnes ikke lenger. Last siden på nytt.');

  // Skap bare der produktet faktisk har et tilhørende, aktivt skap.
  let cabinetName: string | null = null;
  if (checked(formData.get('with_cabinet')) && product.cabinet_product_id) {
    const { data: cabinet } = await supabase
      .from('products')
      .select('name')
      .eq('id', product.cabinet_product_id)
      .eq('active', true)
      .maybeSingle();
    cabinetName = cabinet?.name ?? null;
  }

  const { data: job, error } = await supabase
    .from('production_jobs')
    .insert({
      product_id: product.id,
      product_name: product.name,
      product_number: product.product_number,
      length_m: product.length_m,
      steps: product.steps,
      with_cabinet: cabinetName !== null,
      cabinet_name: cabinetName,
      customer_label: customer,
      vessel_name: optional(formData.get('vessel_name'), 160),
      spec_notes: optional(formData.get('spec_notes'), 2000),
      due_date: due,
    })
    .select('id')
    .single();
  if (error || !job) return fail(error, 'Jobben kunne ikke opprettes.');

  refresh();
  redirect(`/produksjon/${job.id}`);
}
