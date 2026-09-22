import { createServiceSupabase } from '@/lib/supabase/server';
import { MAINTENANCE_EMAIL, sendMail } from '@/lib/mail';
import { maintenanceReceipt, maintenanceReport } from '@/lib/mail/templates';

const BUCKET = 'maintenance-photos';
/**
 * Lenkene i e-posten må overleve at noen arkiverer meldingen og finner den
 * fram igjen måneder senere. Bildene ligger permanent i Storage uansett;
 * dette er bare hvor lenge selve lenken virker.
 */
const LINK_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 dager

/**
 * Sender varsel om en vedlikeholdsrapport, én gang.
 *
 * Idempotent via notified_at: kalles fullfør-steget to ganger (dobbeltklikk,
 * retry etter dårlig dekning), sendes e-posten likevel bare én gang.
 *
 * Rydder samtidig bort bilderader der opplastingen aldri kom fram, slik at
 * loggen viser det som faktisk finnes.
 */
export async function notifyMaintenance(logId: string): Promise<boolean> {
  const supabase = createServiceSupabase();

  const { data: log } = await supabase
    .from('maintenance_logs')
    .select(
      'id, notified_at, ladder_id, serial_number_raw, vessel_name_raw, imo_raw, reporter_name, reporter_email, notes',
    )
    .eq('id', logId)
    .maybeSingle();

  if (!log) return false;
  if (log.notified_at) return true; // allerede varslet

  const { data: photos } = await supabase
    .from('maintenance_photos')
    .select('id, storage_path')
    .eq('maintenance_log_id', logId);

  // Verifiser mot Storage: rader uten fil er opplastinger som aldri ble
  // fullført, og skal ikke telle med i rapporten.
  const links: string[] = [];
  const orphans: string[] = [];

  for (const photo of photos ?? []) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(photo.storage_path, LINK_TTL_SECONDS);

    if (signed?.signedUrl) {
      links.push(signed.signedUrl);
    } else {
      orphans.push(photo.id);
    }
  }

  if (orphans.length > 0) {
    await supabase.from('maintenance_photos').delete().in('id', orphans);
  }

  const name = log.reporter_name ?? 'Ukjent';
  const boat = log.vessel_name_raw ?? '–';
  const serial = log.serial_number_raw ?? '–';

  const report = maintenanceReport({
    name,
    boat,
    imo: log.imo_raw ?? undefined,
    serial,
    email: log.reporter_email ?? undefined,
    notes: log.notes ?? undefined,
    photoCount: links.length,
    matchedLadder: Boolean(log.ladder_id),
  });

  const withLinks =
    links.length > 0
      ? `${report}\n\nBilder (lenkene virker i 90 dager):\n${links
          .map((url, i) => `${i + 1}. ${url}`)
          .join('\n')}`
      : report;

  await sendMail(
    {
      to: MAINTENANCE_EMAIL,
      replyTo: log.reporter_email ?? undefined,
      subject: `Vedlikehold registrert – ${boat} (${serial})`,
      text: withLinks,
    },
    { template: 'maintenance_internal', relatedType: 'maintenance_log', relatedId: log.id },
  );

  if (log.reporter_email) {
    // Kvitteringen til fartøyet er dokumentasjon ved tilsyn, så den skal
    // inneholde selve rapporten – men ikke bildelenkene, som er interne.
    const receipt = maintenanceReceipt({ name, boat, serial, report });
    await sendMail(
      { to: log.reporter_email, replyTo: MAINTENANCE_EMAIL, ...receipt },
      { template: 'maintenance_receipt', relatedType: 'maintenance_log', relatedId: log.id },
    );
  }

  await supabase
    .from('maintenance_logs')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', logId);

  return true;
}
