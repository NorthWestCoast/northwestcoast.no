import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fmtLength } from '@/lib/pricing';
import { SITE_URL } from '@/lib/site';
import { MAINTENANCE_EMAIL, ORDER_EMAIL, sendMail } from './index';
import { type FollowUpLine, certificateIssued, orderConfirmed, orderDelivered } from './templates';

/**
 * Oppfølgings-e-post til kunden når NWC gjør noe med en bestilling eller en
 * leider.
 *
 * Kalles fra server actions etter at databasen har gjort jobben, med den
 * ansattes egen sesjon: det er RLS som avgjør hva som kan leses, og en som
 * ikke ser bestillingen får heller ikke sendt noe. Funksjonene kaster aldri.
 * E-posten er et tillegg til varselet i portalen, så en feil her skal ikke
 * velte handlingen som utløste den.
 */
type Client = SupabaseClient<Database>;

const isEmail = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

async function loadOrder(supabase: Client, orderId: string) {
  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, contact_name, contact_email, expected_delivery, order_lines(qty, custom_length_m, with_cabinet, products(name))',
    )
    .eq('id', orderId)
    .maybeSingle();
  return data;
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

const followUpLines = (order: LoadedOrder): FollowUpLine[] =>
  order.order_lines.map((line) => ({
    name:
      typeof line.custom_length_m === 'number'
        ? `Argostep – ${fmtLength(line.custom_length_m)} m (spesiallengde)`
        : line.products?.name ?? 'Produkt',
    qty: line.qty,
    detail: line.with_cabinet ? 'med oppbevaringsskap' : null,
  }));

/** Statusen bestillingen har nå. Brukes til å se om en handling endret den. */
export async function orderStatus(supabase: Client, orderId: string): Promise<string | null> {
  const { data } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
  return data?.status ?? null;
}

/** Bestillingen er bekreftet: si fra til kontaktpersonen på bestillingen. */
export async function mailOrderConfirmed(supabase: Client, orderId: string): Promise<void> {
  try {
    const order = await loadOrder(supabase, orderId);
    if (!order || !isEmail(order.contact_email)) return;

    await sendMail(
      {
        to: order.contact_email,
        replyTo: ORDER_EMAIL,
        ...orderConfirmed({
          orderNumber: order.order_number,
          name: order.contact_name,
          lines: followUpLines(order),
          expected: order.expected_delivery,
        }),
      },
      { template: 'order_confirmed', relatedType: 'order', relatedId: orderId },
    );
  } catch (error) {
    console.error('[mail] order_confirmed feilet for', orderId, error);
  }
}

/**
 * Bestillingen er levert. Sendes bare når handlingen faktisk flyttet
 * bestillingen til «levert» (previousStatus er statusen før handlingen), så
 * en bestilling med flere leveranser gir én e-post, ikke én per kolli.
 */
export async function mailOrderDelivered(
  supabase: Client,
  orderId: string,
  previousStatus: string | null,
): Promise<void> {
  try {
    if (previousStatus === 'delivered') return;
    const order = await loadOrder(supabase, orderId);
    if (!order || order.status !== 'delivered' || !isEmail(order.contact_email)) return;

    const { data: jobs } = await supabase
      .from('production_jobs')
      .select('serial_number')
      .eq('order_id', orderId)
      .eq('kind', 'ladder')
      .not('serial_number', 'is', null);

    await sendMail(
      {
        to: order.contact_email,
        replyTo: ORDER_EMAIL,
        ...orderDelivered({
          orderNumber: order.order_number,
          name: order.contact_name,
          lines: followUpLines(order),
          serials: (jobs ?? []).map((job) => job.serial_number ?? '').filter(Boolean),
        }),
      },
      { template: 'order_delivered', relatedType: 'order', relatedId: orderId },
    );
  } catch (error) {
    console.error('[mail] order_delivered feilet for', orderId, error);
  }
}

/** Så mange får e-post om ett sertifikat. Resten ser varselet i portalen. */
const MAX_RECIPIENTS = 15;

/**
 * Nytt servicesertifikat: e-post til dem som har tilgang til leideren
 * (selskapet, fartøyet eller leideren selv) og ikke har slått av e-postvarsler.
 */
export async function mailCertificateIssued(supabase: Client, certificateId: string): Promise<void> {
  try {
    const { data: certificate } = await supabase
      .from('ladder_certificates')
      .select('certificate_number, serial_number, vessel_name, project_name, valid_until, verify_token, ladder_id')
      .eq('id', certificateId)
      .maybeSingle();
    if (!certificate) return;

    const { data: ladder } = await supabase
      .from('ladders')
      .select('company_id, vessel_id')
      .eq('id', certificate.ladder_id)
      .maybeSingle();

    const [company, vessel, direct] = await Promise.all([
      ladder?.company_id
        ? supabase.from('company_members').select('user_id').eq('company_id', ladder.company_id)
        : null,
      ladder?.vessel_id
        ? supabase.from('vessel_members').select('user_id').eq('vessel_id', ladder.vessel_id)
        : null,
      supabase.from('ladder_members').select('user_id').eq('ladder_id', certificate.ladder_id),
    ]);

    const userIds = [
      ...new Set([company, vessel, direct].flatMap((result) => (result?.data ?? []).map((row) => row.user_id))),
    ];
    if (userIds.length === 0) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('email')
      .in('user_id', userIds)
      .eq('notify_email', true)
      .limit(MAX_RECIPIENTS);

    const mail = certificateIssued({
      certificateNumber: certificate.certificate_number,
      serial: certificate.serial_number,
      place: certificate.vessel_name ?? certificate.project_name,
      validUntil: certificate.valid_until,
      verifyUrl: `${SITE_URL}/sertifikat/${certificate.verify_token}`,
      ladderUrl: `${SITE_URL}/minside/leider/${certificate.ladder_id}`,
    });

    for (const profile of profiles ?? []) {
      if (!isEmail(profile.email)) continue;
      await sendMail(
        { to: profile.email, replyTo: MAINTENANCE_EMAIL, ...mail },
        { template: 'certificate_issued', relatedType: 'certificate', relatedId: certificateId },
      );
    }
  } catch (error) {
    console.error('[mail] certificate_issued feilet for', certificateId, error);
  }
}
