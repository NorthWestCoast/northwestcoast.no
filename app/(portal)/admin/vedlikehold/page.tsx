import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Card, Empty, KV, PageHeader, Timeline } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Hidden, Select } from '@/components/admin/fields';
import { BUCKETS, signedUrls } from '@/lib/portal/storage';
import { logKind } from '@/lib/portal/labels';
import { dato, datoTid } from '@/lib/format';
import { linkMaintenanceLog } from '../actions';

const COLUMNS = 'id, kind, title, serial_number_raw, vessel_name_raw, imo_raw, reporter_name, reporter_email, performed_at, notes, created_at, source, ladder_id, ladders(serial_number), maintenance_photos(storage_path, caption)';

const SOURCES: Record<string, string> = {
  web: 'Skjemaet på nettsiden',
  portal: 'Min side',
};

function Photos({ photos, urls }: { photos: { storage_path: string; caption: string | null }[]; urls: Map<string, string> }) {
  const visible = photos.filter((photo) => urls.has(photo.storage_path));
  if (visible.length === 0) return null;
  return (
    <div className="pt-photos">
      {visible.map((photo) => (
        <a key={photo.storage_path} href={urls.get(photo.storage_path)} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- signert lenke som utløper, kan ikke optimaliseres */}
          <img src={urls.get(photo.storage_path)} alt={photo.caption ?? 'Bilde fra rapporten'} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

/**
 * Vedlikeholdsrapporter fra det åpne skjemaet og fra Min side.
 *
 * Skjemaet tar imot hvilket som helst produksjonsnummer og lagrer råteksten
 * selv når oppslaget bommer, så en innsending aldri går tapt. De som ikke
 * fant leideren sin kobles til riktig leider her.
 */
export default async function VedlikeholdPage() {
  const { supabase } = await requireStaff();

  const [{ data: unlinked }, { data: recent }, { data: ladders }] = await Promise.all([
    supabase
      .from('maintenance_logs')
      .select(COLUMNS)
      .is('ladder_id', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('maintenance_logs')
      .select(COLUMNS)
      .not('ladder_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, company_name, vessel_name')
      .order('serial_number')
      .limit(1000),
  ]);

  const urls = await signedUrls(
    supabase,
    BUCKETS.logs,
    [...(unlinked ?? []), ...(recent ?? [])].flatMap((log) => log.maintenance_photos.map((photo) => photo.storage_path)),
  );

  return (
    <>
      <PageHeader
        title="Vedlikeholdsrapporter"
        description="Det mannskapet har loggført, fra skjemaet på nettsiden og fra Min side."
      />

      {unlinked?.length ? (
        unlinked.map((log) => (
          <Card
            key={log.id}
            title={`Uten leider: oppgitt nummer «${log.serial_number_raw ?? 'ikke oppgitt'}»`}
            description="Nummeret finnes ikke i registeret. Oftest er det en skrivefeil, eller leideren er ikke registrert ennå."
          >
            <div className="pt-stack">
              <KV
                items={[
                  { label: 'Fartøy', value: log.vessel_name_raw ?? '–' },
                  { label: 'IMO', value: log.imo_raw ?? '–' },
                  { label: 'Innsender', value: log.reporter_name ?? '–' },
                  {
                    label: 'E-post',
                    value: log.reporter_email ? <a href={`mailto:${log.reporter_email}`}>{log.reporter_email}</a> : '–',
                  },
                  { label: 'Utført', value: dato(log.performed_at) },
                  { label: 'Mottatt', value: datoTid(log.created_at) },
                  { label: 'Type', value: logKind(log.kind) },
                  { label: 'Kilde', value: SOURCES[log.source] ?? log.source },
                ]}
              />
              {log.notes && (
                <div className="pt-bubble">
                  <div className="pt-bubble-head"><strong>{log.title ?? 'Notat'}</strong></div>
                  <p>{log.notes}</p>
                </div>
              )}
              <Photos photos={log.maintenance_photos} urls={urls} />
              <PortalForm action={linkMaintenanceLog} submitLabel="Koble til leider">
                <Hidden fields={{ log_id: log.id }} />
                <Select scope={log.id} name="ladder_id" label="Riktig leider" required defaultValue="">
                  <option value="" disabled>Velg leider</option>
                  {ladders?.map((ladder) => (
                    <option key={ladder.ladder_id} value={ladder.ladder_id ?? ''}>
                      {ladder.serial_number}
                      {ladder.company_name ? ` · ${ladder.company_name}` : ''}
                      {ladder.vessel_name ? ` · ${ladder.vessel_name}` : ''}
                    </option>
                  ))}
                </Select>
              </PortalForm>
            </div>
          </Card>
        ))
      ) : (
        <Card title="Rapporter uten leider">
          <Empty title="Alle rapporter er koblet til en leider" />
        </Card>
      )}

      <Card title="Siste rapporter" description="De 50 siste som er koblet til en leider." flush>
        {recent?.length ? (
          <Timeline
            items={recent.map((log) => ({
              key: log.id,
              date: dato(log.performed_at),
              title: (
                <>
                  <Link href={`/minside/leider/${log.ladder_id}`}>
                    {log.ladders?.serial_number ?? log.serial_number_raw ?? 'Leider'}
                  </Link>
                  {' · '}{logKind(log.kind)}{log.title ? ` · ${log.title}` : ''}
                </>
              ),
              text: [
                log.notes,
                [log.reporter_name, log.vessel_name_raw, SOURCES[log.source] ?? log.source].filter(Boolean).join(' · '),
              ].filter(Boolean).join('\n'),
              extra: <Photos photos={log.maintenance_photos} urls={urls} />,
            }))}
          />
        ) : (
          <Empty title="Ingen rapporter ennå" />
        )}
      </Card>
    </>
  );
}
