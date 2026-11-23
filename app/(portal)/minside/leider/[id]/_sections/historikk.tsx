import Link from 'next/link';
import { Badge, Card, Empty, Timeline, type TimelineItem } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import PhotoUploader from '@/components/portal/photo-uploader';
import { CERTIFICATE_NAME, LOG_KINDS, logKind, serviceResult } from '@/lib/portal/labels';
import { BUCKETS, signedUrls } from '@/lib/portal/storage';
import { dato, datoTid, idag } from '@/lib/format';
import CertificateList from '@/components/minside/certificate-list';
import PhotoGrid from '@/components/minside/photo-grid';
import { loadCertificates, loadServicePhotos } from '@/components/minside/service-records';
import { isLogKind } from '@/components/minside/util';
import { addLogEntry, attachLogPhotos } from '../actions';
import type { SectionProps } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

type Entry = { iso: string; created: string; item: TimelineItem };

/**
 * Historikk: alt som er gjort på leideren i én kronologisk liste. Fagmessig
 * service (med bilder og servicesertifikat) og mannskapets egne loggføringer
 * er merket tydelig hver for seg. Sertifikatene står samlet øverst.
 */
export default async function Historikk({ supabase, ctx, ladder, type }: SectionProps & { type?: string }) {
  const id = ladder.ladder_id;
  const base = `/minside/leider/${id}?fane=historikk`;
  const today = idag();

  const kindFilter = isLogKind(type) ? type : null;
  const filter = type === 'service' ? 'service' : kindFilter;

  const logQuery = supabase
    .from('maintenance_logs')
    .select('id, performed_at, created_at, kind, title, notes, reporter_name, reported_by_user_id, source, verified_at')
    .eq('ladder_id', id)
    .order('performed_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);

  // Service og sertifikater vises når det ikke er filtrert på en loggtype.
  const showService = !filter || filter === 'service';

  const [{ data: reports }, { data: logs }, certificates] = await Promise.all([
    showService
      ? supabase
          .from('service_reports')
          .select('id, performed_at, created_at, performed_by, result, findings, next_service_due, report_path')
          .eq('ladder_id', id)
          .order('performed_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    filter === 'service'
      ? Promise.resolve({ data: [] })
      : kindFilter
        ? logQuery.eq('kind', kindFilter)
        : logQuery,
    showService ? loadCertificates(supabase, id) : Promise.resolve([]),
  ]);

  const logIds = (logs ?? []).map((log) => log.id);
  const { data: photoRows } = logIds.length
    ? await supabase
        .from('maintenance_photos')
        .select('id, maintenance_log_id, storage_path, captured_at')
        .in('maintenance_log_id', logIds)
        .order('captured_at', { ascending: true, nullsFirst: false })
    : { data: [] };

  const reportPaths = (reports ?? []).map((r) => r.report_path).filter((p): p is string => Boolean(p));
  const [photoUrls, reportUrls, servicePhotos] = await Promise.all([
    signedUrls(supabase, BUCKETS.logs, (photoRows ?? []).map((p) => p.storage_path)),
    signedUrls(supabase, BUCKETS.reports, reportPaths),
    loadServicePhotos(supabase, (reports ?? []).map((report) => report.id)),
  ]);

  const entries: Entry[] = [];

  for (const report of reports ?? []) {
    const result = serviceResult(report.result);
    const pdf = report.report_path ? reportUrls.get(report.report_path) : undefined;
    const photos = (servicePhotos.get(report.id) ?? []).map((photo, index) => ({
      key: photo.id,
      url: photo.url,
      alt: photo.caption ?? `Bilde ${index + 1} fra service ${dato(report.performed_at)}`,
      caption: photo.caption,
    }));
    const issued = certificates.filter((certificate) => certificate.service_report_id === report.id);
    entries.push({
      iso: report.performed_at,
      created: report.created_at,
      item: {
        key: `service-${report.id}`,
        date: dato(report.performed_at),
        tone: result.tone,
        title: (
          <>
            Service <Badge tone={result.tone}>{result.label}</Badge>
          </>
        ),
        text: [
          `Utført av ${report.performed_by}`,
          report.findings,
          report.next_service_due ? `Neste service innen ${dato(report.next_service_due)}` : null,
        ].filter(Boolean).join('\n'),
        extra: (pdf || photos.length > 0 || issued.length > 0) ? (
          <div className="pt-stack" style={{ marginTop: '0.6rem' }}>
            <PhotoGrid photos={photos} />
            {(pdf || issued.length > 0) && (
              <div>
                {issued.map((certificate) => (
                  <div key={certificate.id}>
                    <a href={certificate.pdfUrl} target="_blank" rel="noopener noreferrer" className="pt-link">
                      {CERTIFICATE_NAME} {certificate.certificate_number} (PDF)
                    </a>
                  </div>
                ))}
                {pdf && (
                  <div>
                    <a href={pdf} target="_blank" rel="noopener noreferrer" className="pt-link">
                      Åpne servicerapporten (PDF)
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : undefined,
      },
    });
  }

  for (const log of logs ?? []) {
    const photos = (photoRows ?? [])
      .filter((p) => p.maintenance_log_id === log.id)
      .flatMap((p) => {
        const url = photoUrls.get(p.storage_path);
        return url
          ? [{ key: p.id, url, alt: `Bilde fra loggføring ${dato(log.performed_at)}`, caption: p.captured_at ? datoTid(p.captured_at) : null }]
          : [];
      });

    // Egne loggføringer kan få bilder det første døgnet (samme grense som lagringen).
    const canAddPhotos =
      log.reported_by_user_id === ctx.userId && Date.now() - Date.parse(log.created_at) < DAY_MS;

    entries.push({
      iso: log.performed_at,
      created: log.created_at,
      item: {
        key: `log-${log.id}`,
        date: dato(log.performed_at),
        title: (
          <>
            {log.title || logKind(log.kind)} <Badge>{logKind(log.kind)}</Badge>
          </>
        ),
        text: [
          log.notes,
          [
            log.reporter_name,
            log.source === 'web'
              ? (log.verified_at ? 'meldt via nettskjema' : 'meldt via nettskjema, ikke bekreftet av NorthWestCoast')
              : log.source === 'admin' ? 'lagt inn av NorthWestCoast' : null,
          ].filter(Boolean).join(' · ') || null,
        ].filter(Boolean).join('\n') || undefined,
        extra: (photos.length > 0 || canAddPhotos) ? (
          <div className="pt-stack" style={{ marginTop: '0.6rem' }}>
            <PhotoGrid photos={photos} />
            {canAddPhotos && (
              <PhotoUploader
                bucket={BUCKETS.logs}
                folder={log.id}
                action={attachLogPhotos}
                fields={{ log_id: log.id, ladder_id: id }}
              />
            )}
          </div>
        ) : undefined,
      },
    });
  }

  entries.sort((a, b) => b.iso.localeCompare(a.iso) || b.created.localeCompare(a.created));

  const filters = [
    { value: '', label: 'Alt' },
    { value: 'service', label: 'Service' },
    ...Object.entries(LOG_KINDS).map(([value, label]) => ({ value, label })),
  ];

  return (
    <>
      {certificates.length > 0 && (
        <Card
          id="sertifikat"
          title={CERTIFICATE_NAME}
          description="Utstedes av NorthWestCoast etter godkjent service. Statusen viser hvilket som gjelder."
          flush
        >
          <CertificateList certificates={certificates} />
        </Card>
      )}

      <Card
        id="ny-logg"
        title="Ny loggføring"
        description="Vedlikehold, kontroller, tester, bruk og reparasjoner. Bilder legger du til etter at loggføringen er lagret."
      >
        <PortalForm action={addLogEntry} submitLabel="Loggfør" tone="green">
          <input type="hidden" name="ladder_id" value={id} />
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="log-kind">Type</label>
              <select id="log-kind" name="kind" defaultValue="maintenance" required>
                {Object.entries(LOG_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="pt-field">
              <label htmlFor="log-date">Dato</label>
              <input id="log-date" name="performed_at" type="date" defaultValue={today} max={today} required />
            </div>
          </div>
          <div className="pt-field">
            <label htmlFor="log-title">Tittel</label>
            <input id="log-title" name="title" maxLength={160} placeholder="F.eks. Kontroll før losbording" />
          </div>
          <div className="pt-field">
            <label htmlFor="log-notes">Notat</label>
            <textarea id="log-notes" name="notes" maxLength={4000} placeholder="Hva ble gjort, og hva ble funnet?" />
          </div>
        </PortalForm>
      </Card>

      <div className="pt-actions" style={{ marginBottom: '1rem' }}>
        {filters.map((item) => {
          const active = (filter ?? '') === item.value;
          return (
            <Link
              key={item.value || 'alt'}
              href={item.value ? `${base}&type=${item.value}` : base}
              className={active ? 'pt-btn pt-btn-sm' : 'pt-btn pt-btn-sm pt-btn-ghost'}
              aria-current={active ? 'true' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <Card title="Historikk" flush>
        {entries.length > 0 ? (
          <Timeline items={entries.map((entry) => entry.item)} />
        ) : (
          <Empty title={filter ? 'Ingen oppføringer av denne typen' : 'Ingen historikk ennå'}>
            {filter ? 'Velg en annen type, eller vis alt.' : 'Loggfør det første vedlikeholdet i skjemaet over.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
