import { headers } from 'next/headers';
import { certificateState, type CertificateState } from '@/lib/portal/labels';
import { portalOrigin } from '@/lib/portal/landing';
import { BUCKETS, signedUrls } from '@/lib/portal/storage';
import { idag } from '@/lib/format';
import type { Tables } from '@/lib/supabase/database.types';
import type { PortalSupabase } from './util';

/**
 * Servicesertifikater og servicebilder for én leider, slik både kunden
 * (historikken) og administratoren (leidersiden) trenger dem. Alt leses med
 * brukerens egen sesjon: RLS avgjør hva som kommer tilbake.
 */

export type Certificate = Pick<
  Tables<'ladder_certificates'>,
  | 'id' | 'certificate_number' | 'service_report_id' | 'issued_on' | 'valid_until' | 'issued_by_name'
  | 'result' | 'remarks' | 'replaced_by' | 'revoked_at' | 'revoked_reason'
> & {
  state: CertificateState;
  /** Nummeret til sertifikatet som erstattet dette. */
  replacedByNumber: string | null;
  /** PDF-en. Krever innlogging og tilgang til leideren. */
  pdfUrl: string;
  /** Kontrollsiden. Åpen for alle som har lenken. */
  verifyUrl: string;
};

/** Adressen til kontrollsiden for et sertifikat, på portalens adresse (se portalOrigin). */
export async function certificateVerifyBase(): Promise<string> {
  return `${portalOrigin(await headers())}/sertifikat`;
}

/** Alle sertifikatene til leideren, nyeste først. */
export async function loadCertificates(supabase: PortalSupabase, ladderId: string): Promise<Certificate[]> {
  const [{ data }, verifyBase] = await Promise.all([
    supabase
      .from('ladder_certificates')
      .select('id, certificate_number, service_report_id, issued_on, valid_until, issued_by_name, result, remarks, verify_token, replaced_by, revoked_at, revoked_reason')
      .eq('ladder_id', ladderId)
      .order('issued_on', { ascending: false })
      .order('created_at', { ascending: false }),
    certificateVerifyBase(),
  ]);

  const rows = data ?? [];
  const today = idag();
  const numbers = new Map(rows.map((row) => [row.id, row.certificate_number]));

  return rows.map(({ verify_token: token, ...row }) => ({
    ...row,
    state: certificateState(row, today),
    replacedByNumber: row.replaced_by ? numbers.get(row.replaced_by) ?? null : null,
    pdfUrl: `/minside/leider/${ladderId}/sertifikat/${row.id}`,
    verifyUrl: `${verifyBase}/${token}`,
  }));
}

/**
 * Sertifikatet som gjelder for leideren nå: det nyeste som verken er erstattet
 * eller trukket tilbake (det kan være utløpt). Finnes ikke det, vises det
 * nyeste uansett, så et tilbaketrukket sertifikat ikke bare blir borte.
 */
export function currentCertificate(certificates: Certificate[]): Certificate | null {
  return certificates.find((c) => c.state === 'valid' || c.state === 'expired') ?? certificates[0] ?? null;
}

export type ServicePhoto = { id: string; url: string; caption: string | null };

/** Bildene til servicerapportene, med signerte lenker, gruppert per rapport. */
export async function loadServicePhotos(
  supabase: PortalSupabase,
  reportIds: string[],
): Promise<Map<string, ServicePhoto[]>> {
  const byReport = new Map<string, ServicePhoto[]>();
  if (reportIds.length === 0) return byReport;

  const { data } = await supabase
    .from('service_report_photos')
    .select('id, service_report_id, storage_path, caption')
    .in('service_report_id', reportIds)
    .order('uploaded_at', { ascending: true });
  const rows = data ?? [];

  const urls = await signedUrls(supabase, BUCKETS.reports, rows.map((row) => row.storage_path));
  for (const row of rows) {
    const url = urls.get(row.storage_path);
    if (!url) continue;
    const list = byReport.get(row.service_report_id) ?? [];
    list.push({ id: row.id, url, caption: row.caption });
    byReport.set(row.service_report_id, list);
  }
  return byReport;
}
