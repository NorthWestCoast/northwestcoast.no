import { Alert, Badge } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import PhotoUploader from '@/components/portal/photo-uploader';
import PhotoGrid from '@/components/minside/photo-grid';
import CertificateList from '@/components/minside/certificate-list';
import { loadCertificates, loadServicePhotos, type Certificate } from '@/components/minside/service-records';
import type { PortalSupabase } from '@/components/minside/util';
import { CERTIFICATE_NAME, CERTIFICATE_NAME_LOWER, serviceResult } from '@/lib/portal/labels';
import { BUCKETS } from '@/lib/portal/storage';
import { dato, idag } from '@/lib/format';
import { attachServicePhotos, deleteServicePhoto, issueCertificate } from '@/app/(portal)/admin/service/actions';
import { Hidden, Input, Textarea } from './fields';
import RevokeCertificate from './revoke-certificate';

/**
 * Servicene på en leider med bilder og servicesertifikater, for
 * administratorer: legg til og slett bilder, utsted et sertifikat fra en
 * rapport som mangler det, og trekk et sertifikat tilbake.
 *
 * Her synes det også hvis en registrering ble avbrutt: en rapport uten
 * bilder eller uten sertifikat står slik den er, og kan fullføres.
 */
export default async function LadderServiceAdmin({
  supabase,
  ladderId,
}: {
  supabase: PortalSupabase;
  ladderId: string;
}) {
  const [{ data: reportRows }, certificates] = await Promise.all([
    supabase
      .from('service_reports')
      .select('id, performed_at, performed_by, result, findings, next_service_due, created_at')
      .eq('ladder_id', ladderId)
      .order('performed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    loadCertificates(supabase, ladderId),
  ]);
  const reports = reportRows ?? [];
  const photos = await loadServicePhotos(supabase, reports.map((report) => report.id));

  if (reports.length === 0 && certificates.length === 0) {
    return <p className="pt-hint">Ingen service er registrert på leideren ennå.</p>;
  }

  const today = idag();
  const latest = reports[0];
  const valid = certificates.find((certificate) => certificate.state === 'valid');
  const reportIds = new Set(reports.map((report) => report.id));
  // Sertifikater der rapporten er slettet.
  const loose = certificates.filter((c) => !c.service_report_id || !reportIds.has(c.service_report_id));

  const revoke = (certificate: Certificate) =>
    certificate.state === 'revoked'
      ? null
      : <RevokeCertificate certificateId={certificate.id} number={certificate.certificate_number} />;

  return (
    <div className="pt-records">
      {latest?.result === 'failed' && valid && (
        <Alert tone="warn" title="Siste service ble ikke godkjent">
          {CERTIFICATE_NAME} {valid.certificate_number} gjelder fortsatt. Trekk det tilbake under hvis det ikke lenger
          skal gjelde.
        </Alert>
      )}

      {reports.map((report) => {
        const result = serviceResult(report.result);
        const own = certificates.filter((certificate) => certificate.service_report_id === report.id);
        const isLatest = report.id === latest?.id;
        // Utstedes fra den siste servicen, og bare når den ikke alt har et sertifikat som står.
        const canIssue =
          isLatest && report.result !== 'failed' && !own.some((c) => c.state === 'valid' || c.state === 'expired');
        const suggested = report.next_service_due && report.next_service_due > today ? report.next_service_due : '';
        const reportPhotos = photos.get(report.id) ?? [];

        return (
          <article key={report.id} className="pt-record">
            <div className="pt-record-head">
              <strong>Service {dato(report.performed_at)}</strong>
              <Badge tone={result.tone}>{result.label}</Badge>
            </div>
            <div className="pt-list-sub">
              Utført av {report.performed_by}
              {report.next_service_due ? ` · neste frist ${dato(report.next_service_due)}` : ''}
              {reportPhotos.length === 0 ? ' · ingen bilder' : ''}
            </div>
            {report.findings && (
              <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{report.findings}</p>
            )}

            <PhotoGrid
              photos={reportPhotos.map((photo, index) => ({
                key: photo.id,
                url: photo.url,
                alt: photo.caption ?? `Bilde ${index + 1} fra service ${dato(report.performed_at)}`,
                below: (
                  <ActionButton
                    action={deleteServicePhoto}
                    fields={{ photo_id: photo.id }}
                    label="Slett"
                    tone="danger"
                    confirm="Slette bildet? Det kan ikke angres."
                  />
                ),
              }))}
            />
            <details className="pt-more">
              <summary>Legg til bilder</summary>
              <PhotoUploader
                bucket={BUCKETS.reports}
                folder={`${ladderId}/${report.id}`}
                action={attachServicePhotos}
                fields={{ report_id: report.id }}
                max={12}
                label="Bilder fra servicen"
              />
            </details>

            <CertificateList certificates={own} plain actions={revoke} />

            {canIssue && (
              <div className="pt-subform">
                <strong>Utsted {CERTIFICATE_NAME_LOWER}</strong>
                <PortalForm action={issueCertificate} submitLabel={`Utsted ${CERTIFICATE_NAME_LOWER}`}>
                  <Hidden fields={{ ladder_id: ladderId, report_id: report.id }} />
                  <div className="pt-form-row">
                    <Input
                      scope={`issue-${report.id}`}
                      name="valid_until"
                      label="Gyldig til"
                      type="date"
                      required
                      defaultValue={suggested}
                      hint={
                        suggested
                          ? 'Forslaget er neste servicefrist.'
                          : 'Neste servicefrist er passert. Sett en dato fram i tid.'
                      }
                    />
                  </div>
                  <Textarea
                    scope={`issue-${report.id}`}
                    name="remarks"
                    label="Merknad (valgfritt)"
                    rows={2}
                    maxLength={2000}
                  />
                </PortalForm>
              </div>
            )}
            {isLatest && report.result === 'failed' && (
              <p className="pt-hint">
                Leideren ble ikke godkjent, så {CERTIFICATE_NAME_LOWER} kan ikke utstedes fra denne servicen.
              </p>
            )}
          </article>
        );
      })}

      {loose.length > 0 && (
        <div className="pt-record">
          <strong>{CERTIFICATE_NAME} uten servicerapport</strong>
          <CertificateList certificates={loose} plain actions={revoke} />
        </div>
      )}
    </div>
  );
}
