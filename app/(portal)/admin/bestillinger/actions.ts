'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { dato, idag } from '@/lib/format';
import { mailOrderConfirmed, mailOrderDelivered, orderStatus } from '@/lib/mail/events';

/** Etter en endring: bestillingen, listene og tellerne i menyen. */
function refresh(orderId: string) {
  revalidatePath(`/admin/bestillinger/${orderId}`);
  revalidatePath('/admin/bestillinger');
  revalidatePath('/admin/leveranser');
  revalidatePath('/admin', 'layout');
  revalidatePath('/minside/bestillinger');
}

/**
 * Bekrefter bestillingen. Databasen lager én produksjonsjobb per leider og én
 * per skap som er bestilt alene, og varsler produksjon og kunden.
 */
export async function confirmOrder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  if (!orderId) return err('Fant ikke bestillingen.');

  const dueRaw = text(formData.get('due_date'), 12);
  const dueDate = isoDate(dueRaw);
  if (dueRaw && !dueDate) return err('Ferdigdatoen er ikke gyldig.');

  const { data: jobs, error } = await supabase.rpc(
    'confirm_order',
    dueDate ? { p_order: orderId, p_due_date: dueDate } : { p_order: orderId },
  );
  if (error) return fail(error);

  refresh(orderId);
  revalidatePath('/produksjon');

  // Kunden får varsel i portalen fra databasen; e-posten når også den som
  // bestilte fra nettsiden uten konto.
  await mailOrderConfirmed(supabase, orderId);

  if (!jobs) return ok('Bestillingen er bekreftet. Den har verken leidere eller skap, så ingen produksjonsjobb ble opprettet.');
  return ok(
    jobs === 1
      ? 'Bestillingen er bekreftet, og 1 produksjonsjobb er opprettet.'
      : `Bestillingen er bekreftet, og ${jobs} produksjonsjobber er opprettet.`,
  );
}

/**
 * Knytter bestillingen til et selskap, så selskapet ser den på Min side.
 * Leidere og skap som allerede er opprettet fra bestillingens
 * produksjonsjobber følger med, så sant de ikke er plassert på et fartøy eller
 * i et prosjekt (da følger de det).
 */
export async function linkOrderCompany(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  const companyId = uuid(formData.get('company_id'));
  if (!orderId) return err('Fant ikke bestillingen.');
  if (!companyId) return err('Velg et selskap.');

  const { data: company } = await supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle();
  if (!company) return err('Fant ikke selskapet.');

  const { error } = await supabase.from('orders').update({ company_id: company.id }).eq('id', orderId);
  if (error) return fail(error);

  const { data: jobs } = await supabase
    .from('production_jobs')
    .select('id, ladder_id')
    .eq('order_id', orderId);

  const ladderIds = (jobs ?? []).map((job) => job.ladder_id).filter((id): id is string => id !== null);
  if (ladderIds.length > 0) {
    const { error: ladderError } = await supabase
      .from('ladders')
      .update({ company_id: company.id })
      .in('id', ladderIds)
      .is('vessel_id', null)
      .is('project_id', null);
    if (ladderError) return fail(ladderError, 'Bestillingen er knyttet til selskapet, men leiderne ble ikke flyttet.');
  }

  // Leverte skap fra bestillingen: de som ikke er plassert ennå, får samme eier.
  const jobIds = (jobs ?? []).map((job) => job.id);
  if (jobIds.length > 0) {
    const { error: cabinetError } = await supabase
      .from('cabinets')
      .update({ company_id: company.id })
      .in('job_id', jobIds)
      .is('vessel_id', null)
      .is('project_id', null);
    if (cabinetError) return fail(cabinetError, 'Bestillingen er knyttet til selskapet, men skapene ble ikke flyttet.');
  }

  // Produksjon ser kundenavnet på jobben; hold det likt med bestillingen.
  if (jobs?.length) {
    await supabase.from('production_jobs').update({ customer_label: company.name }).eq('order_id', orderId);
  }

  refresh(orderId);
  revalidatePath(`/admin/selskap/${company.id}`);
  revalidatePath('/admin/skap');
  return ok(
    ladderIds.length > 0
      ? `Bestillingen og ${ladderIds.length} leider(e) er knyttet til ${company.name}.`
      : `Bestillingen er knyttet til ${company.name}.`,
  );
}

/** Setter status til «tilbud sendt» eller «kansellert». */
export async function setOrderStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  const status = text(formData.get('status'), 20);
  if (!orderId) return err('Fant ikke bestillingen.');
  if (status !== 'quoted' && status !== 'cancelled') return err('Ugyldig status.');

  const { data: order } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
  if (!order) return err('Fant ikke bestillingen.');
  if (status === 'quoted' && order.status !== 'new') {
    return err('Bare nye bestillinger kan settes til «Tilbud sendt».');
  }
  if (status === 'cancelled' && (order.status === 'delivered' || order.status === 'cancelled')) {
    return err('Bestillingen er allerede avsluttet.');
  }

  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) return fail(error);

  refresh(orderId);
  return ok(status === 'quoted' ? 'Status er satt til «Tilbud sendt».' : 'Bestillingen er kansellert.');
}

export async function setExpectedDelivery(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  if (!orderId) return err('Fant ikke bestillingen.');

  const raw = text(formData.get('expected_delivery'), 12);
  const date = isoDate(raw);
  if (raw && !date) return err('Datoen er ikke gyldig.');

  const { error } = await supabase.from('orders').update({ expected_delivery: date }).eq('id', orderId);
  if (error) return fail(error);

  refresh(orderId);
  return ok(date ? `Forventet levering er satt til ${dato(date)}.` : 'Forventet levering er fjernet.');
}

/**
 * Registrerer en leveranse for hånd. Brukes for bestillinger uten
 * produksjonsjobb (reservedeler); leidere og skap får leveransen sin når
 * produksjon sender jobben.
 */
export async function registerDelivery(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const orderId = uuid(formData.get('order_id'));
  const shippedAt = isoDate(formData.get('shipped_at'));
  if (!orderId) return err('Fant ikke bestillingen.');
  if (!shippedAt) return err('Velg datoen varene ble sendt.');

  const { data: order } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
  if (!order) return err('Fant ikke bestillingen.');
  if (order.status === 'new' || order.status === 'quoted') return err('Bekreft bestillingen før leveransen registreres.');
  if (order.status === 'cancelled') return err('Bestillingen er kansellert.');

  const { error } = await supabase.from('deliveries').insert({
    order_id: orderId,
    shipped_at: shippedAt,
    carrier: optional(formData.get('carrier'), 120),
    tracking_reference: optional(formData.get('tracking_reference'), 120),
  });
  if (error) return fail(error);

  refresh(orderId);
  return ok('Leveransen er registrert.');
}

/**
 * Markerer en leveranse som levert.
 *
 * Hører leveransen til en produksjonsjobb, går det gjennom advance_job(), som
 * også oppdaterer leideren og varsler kunden. Ellers settes datoen direkte,
 * og bestillingen blir levert når ingen jobber står igjen.
 */
export async function markDelivered(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const deliveryId = uuid(formData.get('delivery_id'));
  if (!deliveryId) return err('Fant ikke leveransen.');

  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, order_id, job_id, delivered_at, production_jobs(status)')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!delivery) return err('Fant ikke leveransen.');
  if (delivery.delivered_at) return err('Leveransen er allerede markert som levert.');

  const statusBefore = await orderStatus(supabase, delivery.order_id);
  const jobStatus = delivery.production_jobs?.status;
  if (delivery.job_id && (jobStatus === 'ready' || jobStatus === 'shipped')) {
    const { error } = await supabase.rpc('advance_job', { p_job: delivery.job_id, p_status: 'delivered' });
    if (error) return fail(error);
    revalidatePath('/produksjon');
  } else {
    const { error } = await supabase.from('deliveries').update({ delivered_at: idag() }).eq('id', deliveryId);
    if (error) return fail(error);

    const { count: openJobs } = await supabase
      .from('production_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', delivery.order_id)
      .not('status', 'in', '(delivered,cancelled)');

    if (openJobs === 0) {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', delivery.order_id)
        .in('status', ['confirmed', 'in_production']);
      if (orderError) return fail(orderError, 'Leveransen er levert, men bestillingen ble ikke oppdatert.');
    }
  }

  refresh(delivery.order_id);
  await mailOrderDelivered(supabase, delivery.order_id, statusBefore);
  return ok('Leveransen er markert som levert.');
}
