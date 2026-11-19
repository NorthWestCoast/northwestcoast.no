import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import CertificateDocument, { type CertificateData } from '@/lib/pdf/certificate';
import { createServerSupabase } from '@/lib/supabase/server';
import { uuid } from '@/lib/portal/forms';
import { CERTIFICATE_NAME, certificateState } from '@/lib/portal/labels';
import { portalOrigin } from '@/lib/portal/landing';
import { idag } from '@/lib/format';

export const maxDuration = 30;

const notFound = () => NextResponse.json({ error: 'Fant ikke dokumentet.' }, { status: 404 });

/**
 * Servicesertifikatet som PDF.
 *
 * Tilgangen styres av RLS: sertifikatet leses med brukerens egen sesjon, så
 * både kunden og administratoren får det, og alle andre får «fant ikke».
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> },
) {
  const { id: rawId, certId: rawCertId } = await params;
  const ladderId = uuid(rawId);
  const certificateId = uuid(rawCertId);
  if (!ladderId || !certificateId) return notFound();

  const supabase = await createServerSupabase();
  const origin = portalOrigin(request.headers);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = `/minside/leider/${ladderId}/sertifikat/${certificateId}`;
    return NextResponse.redirect(new URL(`/logg-inn?neste=${encodeURIComponent(next)}`, origin));
  }

  const { data: certificate } = await supabase
    .from('ladder_certificates')
    .select('id, certificate_number, service_report_id, issued_on, valid_until, issued_by_name, result, remarks, serial_number, product_name, length_m, company_name, vessel_name, project_name, verify_token, replaced_by, revoked_at, revoked_reason')
    .eq('id', certificateId)
    .eq('ladder_id', ladderId)
    .maybeSingle();
  if (!certificate) return notFound();

  const [{ data: report }, { data: replacement }] = await Promise.all([
    certificate.service_report_id
      ? supabase
          .from('service_reports')
          .select('performed_at, performed_by')
          .eq('id', certificate.service_report_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    certificate.replaced_by
      ? supabase
          .from('ladder_certificates')
          .select('certificate_number')
          .eq('id', certificate.replaced_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const data: CertificateData = {
    number: certificate.certificate_number,
    state: certificateState(certificate, idag()),
    issuedOn: certificate.issued_on,
    validUntil: certificate.valid_until,
    issuedByName: certificate.issued_by_name,
    result: certificate.result,
    remarks: certificate.remarks,
    serviceDate: report?.performed_at ?? null,
    servicePerformedBy: report?.performed_by ?? null,
    ladder: {
      serialNumber: certificate.serial_number,
      productName: certificate.product_name,
      lengthM: certificate.length_m,
    },
    owner: {
      company: certificate.company_name,
      vessel: certificate.vessel_name,
      project: certificate.project_name,
    },
    revokedAt: certificate.revoked_at,
    revokedReason: certificate.revoked_reason,
    replacedByNumber: replacement?.certificate_number ?? null,
    // Lenken på dokumentet peker på portalens adresse (se portalOrigin).
    verifyUrl: `${origin}/sertifikat/${certificate.verify_token}`,
    generatedAt: new Date(),
  };

  const buffer = await renderToBuffer(<CertificateDocument data={data} />);

  // Buffer godtas ikke som BodyInit (se ../../pdf/route.tsx); kopieres til en ren ArrayBuffer.
  const body = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(body).set(buffer);

  // Bare ASCII i filnavnet: HTTP-hoder tåler ikke æ, ø og å om navnet på dokumentet byttes.
  const filename = `${CERTIFICATE_NAME}-${certificate.certificate_number}.pdf`.replace(/[^A-Za-z0-9._-]/g, '');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      // inline: åpnes i nettleseren, og kan lagres eller skrives ut derfra.
      'Content-Disposition': `inline; filename="${filename}"`,
      // Statusen kan endre seg (erstattet, trukket tilbake): aldri fra cache.
      'Cache-Control': 'private, no-store',
    },
  });
}
