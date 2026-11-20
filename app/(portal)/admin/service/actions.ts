'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, checked, err, fail, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { mailCertificateIssued } from '@/lib/mail/events';
import { CERTIFICATE_NAME, CERTIFICATE_NAME_LOWER } from '@/lib/portal/labels';
import { nextServiceDue } from '@/lib/portal/service';
import { BUCKETS } from '@/lib/portal/storage';
import { dato, idag } from '@/lib/format';
import { parseUploadedPhotos } from '@/components/minside/photos';

/**
 * Service: bestillinger fra kundene, registrering av utført service med
 * bilder, og servicesertifikatet som utstedes etterpå.
 *
 * Databasen varsler kunden selv: når en bestilling blir avtalt, flyttet
 * eller avlyst, når en servicerapport lagres, og når et sertifikat utstedes.
 */

type Failure = { ok: false; error: string };

/** Svar fra handlinger som gir mer tilbake enn en melding (id-en til det som ble lagret). */
export type ServiceSaved =
  | { ok: true; message: string; reportId: string; ladderId: string; nextDue: string }
  | Failure;

export type CertificateIssued =
  | { ok: true; message: string; certificateId: string; certificateNumber: string; validUntil: string; ladderId: string }
  | Failure;

const no = (error: string): Failure => ({ ok: false, error });

/** fail() for handlingene over: oversetter databasefeilen, men er alltid en feil. */
function failure(error: Parameters<typeof fail>[0], fallback: string): Failure {
  const result = fail(error, fallback);
  return result.ok ? no(fallback) : result;
}

function refresh(ladderId: string) {
  revalidatePath('/admin/service');
  revalidatePath('/admin', 'layout');
  revalidatePath(`/minside/leider/${ladderId}`);
}

/** Avtaler (eller flytter) en servicebestilling: dato, tekniker og melding til kunden. */
export async function scheduleBooking(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const bookingId = uuid(formData.get('booking_id'));
  const date = isoDate(formData.get('scheduled_date'));
  if (!bookingId) return err('Fant ikke bestillingen.');
  if (!date) return err('Velg en dato.');

  const { data, error } = await supabase
    .from('service_bookings')
    .update({
      status: 'scheduled',
      scheduled_date: date,
      technician: optional(formData.get('technician'), 120),
      staff_note: optional(formData.get('staff_note'), 1000),
    })
    .eq('id', bookingId)
    .in('status', ['requested', 'scheduled'])
    .select('ladder_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Bestillingen er allerede utført eller avlyst.');

  refresh(data.ladder_id);
  return ok(`Service er avtalt ${dato(date)}. De som har tilgang til leideren får varsel.`);
}

export async function cancelBooking(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const bookingId = uuid(formData.get('booking_id'));
  if (!bookingId) return err('Fant ikke bestillingen.');

  const { data, error } = await supabase
    .from('service_bookings')
    .update({ status: 'cancelled', staff_note: optional(formData.get('staff_note'), 1000) })
    .eq('id', bookingId)
    .in('status', ['requested', 'scheduled'])
    .select('ladder_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Bestillingen er allerede utført eller avlyst.');

  refresh(data.ladder_id);
  return ok('Servicebestillingen er avlyst.');
}

// ── Servicerapport ─────────────────────────────────────────────────────────

/**
 * Registrerer en fagmessig service. Det er denne som teller ved tilsyn, og
 * den avslutter åpne servicebestillinger på leideren (trigger i databasen).
 *
 * Svaret inneholder id-en til rapporten: bildene lastes opp i rapportens
 * mappe etterpå, og sertifikatet utstedes fra den (components/admin/service-form.tsx).
 * Skal det utstedes sertifikat, kontrolleres datoen her, før noe er lagret.
 */
export async function recordService(formData: FormData): Promise<ServiceSaved> {
  const { supabase, user } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const performedAt = isoDate(formData.get('performed_at'));
  const performedBy = text(formData.get('performed_by'), 120);
  const result = text(formData.get('result'), 20);

  if (!ladderId || !performedAt || !performedBy) return no('Leider, dato og utført av er påkrevd.');
  if (result !== 'ok' && result !== 'ok_with_remarks' && result !== 'failed') return no('Velg et resultat.');

  const today = idag();
  if (performedAt > today) return no('Datoen for servicen kan ikke ligge fram i tid.');

  // Er ikke neste frist satt, beregnes den fra leiderens eget intervall –
  // samme regel som ladder_status bruker.
  let nextDue = isoDate(formData.get('next_service_due'));
  if (nextDue && nextDue < performedAt) return no('Neste frist kan ikke være før servicen ble utført.');
  if (!nextDue) {
    const { data: ladder } = await supabase
      .from('ladders')
      .select('service_interval_months')
      .eq('id', ladderId)
      .maybeSingle();
    if (!ladder) return no('Fant ikke leideren.');
    nextDue = nextServiceDue(performedAt, ladder.service_interval_months);
  }

  if (checked(formData.get('issue_certificate'))) {
    if (result === 'failed') {
      return no(`Leideren ble ikke godkjent, så ${CERTIFICATE_NAME_LOWER} kan ikke utstedes.`);
    }
    const validUntil = isoDate(formData.get('certificate_valid_until')) ?? nextDue;
    if (validUntil <= today) {
      return no(`«Gyldig til» på ${CERTIFICATE_NAME_LOWER} må være en dato etter i dag.`);
    }
  }

  const { data: report, error } = await supabase
    .from('service_reports')
    .insert({
      ladder_id: ladderId,
      performed_at: performedAt,
      performed_by: performedBy,
      technician_user_id: user.id,
      findings: optional(formData.get('findings'), 4000),
      result,
      next_service_due: nextDue,
    })
    .select('id')
    .single();
  if (error || !report) return failure(error, 'Servicerapporten kunne ikke lagres.');

  refresh(ladderId);
  return {
    ok: true,
    message: `Servicerapporten er lagret. Neste frist: ${dato(nextDue)}.`,
    reportId: report.id,
    ladderId,
    nextDue,
  };
}

/**
 * Knytter opplastede bilder til en servicerapport. Bildene er lastet opp fra
 * nettleseren til mappen <leider-id>/<rapport-id>/ i bøtta service-reports;
 * bare stier i akkurat den mappen godtas.
 */
export async function attachServicePhotos(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const reportId = uuid(formData.get('report_id'));
  if (!reportId) return err('Fant ikke servicerapporten.');

  const { data: report } = await supabase
    .from('service_reports')
    .select('id, ladder_id')
    .eq('id', reportId)
    .maybeSingle();
  if (!report) return err('Fant ikke servicerapporten.');

  const photos = parseUploadedPhotos(formData.get('photos'), `${report.ladder_id}/${report.id}`);
  if (photos.length === 0) return err('Ingen bilder å lagre.');

  // Kommer samme liste to ganger (svaret forsvant på veien), lagres bildene én gang.
  const { data: existing } = await supabase
    .from('service_report_photos')
    .select('storage_path')
    .eq('service_report_id', report.id);
  const known = new Set((existing ?? []).map((row) => row.storage_path));
  const fresh = photos.filter((photo) => !known.has(photo.path));

  if (fresh.length > 0) {
    const { error } = await supabase.from('service_report_photos').insert(
      fresh.map((photo) => ({ service_report_id: report.id, storage_path: photo.path })),
    );
    if (error) return fail(error, 'Bildene kunne ikke lagres.');
  }

  refresh(report.ladder_id);
  return ok(photos.length === 1 ? 'Bildet er lagt til.' : `${photos.length} bilder er lagt til.`);
}

/** Sletter ett bilde fra en servicerapport, både fila og raden. */
export async function deleteServicePhoto(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const photoId = uuid(formData.get('photo_id'));
  if (!photoId) return err('Fant ikke bildet.');

  const { data: photo } = await supabase
    .from('service_report_photos')
    .select('id, storage_path, service_reports(ladder_id)')
    .eq('id', photoId)
    .maybeSingle();
  if (!photo) return err('Fant ikke bildet.');

  // Fila først: feiler det, står bildet fortsatt i rapporten og kan slettes på nytt.
  const { error: storageError } = await supabase.storage.from(BUCKETS.reports).remove([photo.storage_path]);
  if (storageError) {
    console.error('[service] Kunne ikke slette bildefil:', storageError.message);
    return err('Bildet kunne ikke slettes. Prøv igjen.');
  }

  const { error } = await supabase.from('service_report_photos').delete().eq('id', photo.id);
  if (error) return fail(error, 'Bildet kunne ikke slettes.');

  if (photo.service_reports) refresh(photo.service_reports.ladder_id);
  return ok('Bildet er slettet.');
}

// ── Servicesertifikat ──────────────────────────────────────────────────────

/**
 * Utsteder et servicesertifikat fra en servicerapport. Databasen kopierer
 * opplysningene om leideren inn i sertifikatet, lar det erstatte det som
 * gjaldt fra før, og varsler kunden. Uten «gyldig til» brukes neste
 * servicefrist fra rapporten.
 */
export async function issueCertificate(formData: FormData): Promise<CertificateIssued> {
  const { supabase } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const reportId = uuid(formData.get('report_id'));
  if (!ladderId || !reportId) return no('Fant ikke servicerapporten.');

  const validUntilRaw = text(formData.get('valid_until'), 12);
  const validUntil = isoDate(validUntilRaw);
  if (validUntilRaw && !validUntil) return no('«Gyldig til» er ikke en gyldig dato.');
  if (validUntil && validUntil <= idag()) return no('«Gyldig til» må være en dato etter i dag.');

  const { data: certificateId, error } = await supabase.rpc('issue_ladder_certificate', {
    p_ladder: ladderId,
    p_service_report: reportId,
    p_valid_until: validUntil ?? undefined,
    p_remarks: optional(formData.get('remarks'), 2000) ?? undefined,
  });
  if (error || !certificateId) return failure(error, `${CERTIFICATE_NAME} kunne ikke utstedes.`);

  await mailCertificateIssued(supabase, certificateId);

  const { data: certificate } = await supabase
    .from('ladder_certificates')
    .select('certificate_number, valid_until')
    .eq('id', certificateId)
    .maybeSingle();

  refresh(ladderId);
  return {
    ok: true,
    message: certificate
      ? `${CERTIFICATE_NAME} ${certificate.certificate_number} er utstedt, gyldig til ${dato(certificate.valid_until)}. De som har tilgang til leideren får varsel.`
      : `${CERTIFICATE_NAME} er utstedt.`,
    certificateId,
    certificateNumber: certificate?.certificate_number ?? '',
    validUntil: certificate?.valid_until ?? '',
    ladderId,
  };
}

/**
 * Trekker et sertifikat tilbake. Raden beholdes med tidspunkt og begrunnelse,
 * og kontrollsiden viser at sertifikatet ikke lenger gjelder.
 */
export async function revokeCertificate(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const certificateId = uuid(formData.get('certificate_id'));
  const reason = text(formData.get('reason'), 500);
  if (!certificateId) return err('Fant ikke dokumentet.');
  if (reason.length < 3) return err('Skriv en begrunnelse.');

  const { data, error } = await supabase
    .from('ladder_certificates')
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq('id', certificateId)
    .is('revoked_at', null)
    .select('ladder_id, certificate_number')
    .maybeSingle();
  if (error) return fail(error, 'Det kunne ikke trekkes tilbake. Prøv igjen.');
  if (!data) return err('Det er allerede trukket tilbake.');

  refresh(data.ladder_id);
  return ok(`${CERTIFICATE_NAME} ${data.certificate_number} er trukket tilbake.`);
}
