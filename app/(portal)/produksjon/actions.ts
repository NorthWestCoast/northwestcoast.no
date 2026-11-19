'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireProduction } from '@/lib/portal/context';
import {
  type ActionResult,
  checked,
  err,
  fail,
  int,
  isoDate,
  ok,
  optional,
  text,
  uuid,
} from '@/lib/portal/forms';
import { CUSTOM_PRODUCT_NUMBER, fmtLength, isCustomLength } from '@/lib/pricing';

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

/**
 * Registrerer (eller retter) produksjonsnummeret. For en leider opprettes
 * leideren i databasen; et skap får bare nummeret på jobben.
 */
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

/**
 * Marker jobben som levert. Leideren får status levert hos kunden, og et skap
 * (bestilt alene eller sammen med leideren) opprettes som egen enhet.
 */
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

/**
 * Retter frist og spesielle krav på en jobb, og antall trinn der det ikke
 * følger av produktet (spesiallengder). Bare administratorer.
 */
export async function updateJob(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin('/produksjon');

  const job = uuid(formData.get('job'));
  if (!job) return err('Fant ikke jobben.');

  const rawDue = text(formData.get('due_date'), 12);
  const due = isoDate(rawDue);
  if (rawDue && !due) return err('Fristen er ikke en gyldig dato.');

  const patch: { due_date: string | null; spec_notes: string | null; steps?: number | null } = {
    due_date: due,
    spec_notes: optional(formData.get('spec_notes'), 2000),
  };
  // Feltet finnes bare i skjemaet for leidere uten fastsatt antall trinn.
  if (formData.has('steps')) {
    const rawSteps = text(formData.get('steps'), 6);
    const steps = int(rawSteps, 1, 200);
    if (rawSteps && steps === null) return err('Antall trinn må være et helt tall mellom 1 og 200.');
    patch.steps = steps;
  }

  let query = supabase.from('production_jobs').update(patch).eq('id', job);
  // Et skap har ikke trinn, uansett hva som måtte bli sendt inn.
  if ('steps' in patch) query = query.eq('kind', 'ladder');

  const { data, error } = await query.select('id');
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
 *
 * Jobben får slaget sitt fra produktet: en leider, eller et oppbevaringsskap
 * som produseres alene (uten lengde og trinn, og bare med stegene som gjelder
 * skap). En spesiallengde får lengden fra skjemaet, og ingen trinn.
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

  // Hele lista hentes: skapet til en spesiallengde finnes via standardleiderne.
  const { data: catalog, error: productError } = await supabase
    .from('products')
    .select('id, kind, name, product_number, length_m, steps, cabinet_product_id')
    .in('kind', ['ladder', 'cabinet'])
    .eq('active', true);
  if (productError) return fail(productError);

  const product = (catalog ?? []).find((row) => row.id === productId);
  if (!product) return err('Produktet finnes ikke lenger. Last siden på nytt.');

  const isCabinet = product.kind === 'cabinet';
  const isCustom = !isCabinet && product.product_number === CUSTOM_PRODUCT_NUMBER;
  const ladders = (catalog ?? []).filter(
    (row) => row.kind === 'ladder' && row.length_m !== null && row.product_number !== CUSTOM_PRODUCT_NUMBER,
  );
  const activeCabinet = (id: string | null) =>
    (catalog ?? []).find((row) => row.kind === 'cabinet' && row.id === id) ?? null;

  let name = product.name;
  let length = isCabinet ? null : product.length_m;
  let steps = isCabinet ? null : product.steps;

  if (isCustom) {
    const custom = Number(text(formData.get('custom_length'), 8).replace(',', '.'));
    if (!isCustomLength(custom)) {
      return err('Skriv inn lengden i hele eller halve meter, mellom 1,5 og 30.');
    }
    if (ladders.some((row) => Number(row.length_m) === custom)) {
      return err(`${fmtLength(custom)} m er en standardlengde. Velg den i produktlista.`);
    }
    // Samme navn som databasen gir spesiallengder fra bestillinger.
    name = `Argostep – ${fmtLength(custom)} m (spesiallengde)`;
    length = custom;
    steps = null;
  }

  // Skap bare der leideren faktisk har et tilhørende, aktivt skap. En
  // spesiallengde får skapet til nærmeste standardlengde over.
  let cabinet: { id: string; name: string } | null = null;
  if (!isCabinet && checked(formData.get('with_cabinet'))) {
    cabinet = isCustom
      ? ladders
          .filter((row) => Number(row.length_m) >= (length as number))
          .sort((a, b) => Number(a.length_m) - Number(b.length_m))
          .map((row) => activeCabinet(row.cabinet_product_id))
          .find((row) => row !== null) ?? null
      : activeCabinet(product.cabinet_product_id);
  }

  const { data: job, error } = await supabase
    .from('production_jobs')
    .insert({
      product_id: product.id,
      kind: isCabinet ? 'cabinet' : 'ladder',
      product_name: name,
      product_number: product.product_number,
      length_m: length,
      steps,
      with_cabinet: cabinet !== null,
      cabinet_name: cabinet?.name ?? null,
      cabinet_product_id: cabinet?.id ?? null,
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
