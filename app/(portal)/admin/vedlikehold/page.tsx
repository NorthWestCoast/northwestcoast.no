import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Card, Empty, KV, PageHeader, Td, Timeline } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Hidden, SearchForm, Select } from '@/components/admin/fields';
import MaintenanceReportForm from '@/components/admin/maintenance-report-form';
import { uuid } from '@/lib/portal/forms';
import { BUCKETS, signedUrls } from '@/lib/portal/storage';
import { logKind } from '@/lib/portal/labels';
import { dato, datoTid, idag } from '@/lib/format';
import { linkMaintenanceLog } from '../actions';
import { anyColumnMatches, searchTerm } from '../_lib/search';

const COLUMNS = 'id, kind, title, serial_number_raw, vessel_name_raw, imo_raw, reporter_name, reporter_email, performed_at, notes, created_at, source, ladder_id, ladders(serial_number), maintenance_photos(storage_path, caption)';

const SOURCES: Record<string, string> = {
  web: 'Skjemaet på nettsiden',
  portal: 'Min side',
  admin: 'Lagt inn av NorthWest Coast',
};

const LADDER_COLUMNS = 'ladder_id, serial_number, product_name, company_name, vessel_name, project_name';

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
 * Vedlikeholdsrapporter: de som kommer fra det åpne skjemaet og fra Min side,
 * og de NorthWest Coast legger inn selv («Ny rapport»).
 *
 * Skjemaet på nettsiden tar imot hvilket som helst produksjonsnummer og lagrer
 * råteksten selv når oppslaget bommer, så en innsending aldri går tapt. De som
 * ikke fant leideren sin kobles til riktig leider her.
 *
 * Ny rapport: leideren velges først (søk med ?q=, valgt med ?leider=), så
 * fylles skjemaet ut. Leidersiden lenker hit med leideren forhåndsvalgt.
 */
export default async function VedlikeholdPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; leider?: string }>;
}) {
  const params = await searchParams;
  const q = searchTerm(params.q);
  const selectedId = uuid(params.leider ?? null);
  const { supabase, ctx } = await requireStaff();

  const [{ data: unlinked }, { data: recent }, { data: ladders }, { data: selected }, { data: matches }] = await Promise.all([
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
    selectedId
      ? supabase.from('ladder_status').select(LADDER_COLUMNS).eq('ladder_id', selectedId).maybeSingle()
      : Promise.resolve({ data: null }),
    q && !selectedId
      ? supabase
          .from('ladder_status')
          .select(LADDER_COLUMNS)
          .or(anyColumnMatches(['serial_number', 'vessel_name', 'company_name', 'project_name'], q))
          .order('serial_number')
          .limit(20)
      : Promise.resolve({ data: null }),
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
        description="Det mannskapet har loggført, fra skjemaet på nettsiden og fra Min side, og det NorthWest Coast legger inn selv."
      />

      <Card
        id="ny"
        title="Ny rapport"
        description="Vedlikehold NorthWest Coast har utført, eller noe kunden har meldt på telefon eller e-post. Kunden ser rapporten i historikken til leideren."
        flush
      >
        {selected?.ladder_id ? (
          <div className="pt-card-body pt-stack">
            <div className="pt-record-head" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>
                  Leider{' '}
                  <Link href={`/minside/leider/${selected.ladder_id}`} className="pt-link">{selected.serial_number}</Link>
                </strong>
                <div className="pt-list-sub">
                  {[selected.product_name, selected.company_name, selected.vessel_name ?? selected.project_name]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <Link href="/admin/vedlikehold#ny" className="pt-btn pt-btn-ghost pt-btn-sm">Bytt leider</Link>
            </div>
            <MaintenanceReportForm
              ladderId={selected.ladder_id}
              performedBy={ctx.displayName}
              today={idag()}
              scope="ny"
            />
          </div>
        ) : (
          <>
            <div className="pt-card-body pt-stack">
              {selectedId && <p className="pt-msg" data-ok="false" role="alert">Fant ikke leideren. Søk den opp under.</p>}
              <SearchForm
                action="/admin/vedlikehold#ny"
                q={q}
                placeholder="Søk på produksjonsnummer, fartøy eller kunde"
              />
              {!q && <p className="pt-hint">Søk opp leideren rapporten gjelder, og velg den.</p>}
              {q && !matches?.length && <p className="pt-hint">Ingen leidere passer med «{q}».</p>}
            </div>
            {matches && matches.length > 0 && (
              <table className="pt-table">
                <thead>
                  <tr><th>Leider</th><th>Kunde</th><th>Står på</th><th /></tr>
                </thead>
                <tbody>
                  {matches.map((ladder) => (
                    <tr key={ladder.ladder_id}>
                      <Td label="Leider" className="pt-table-strong">{ladder.serial_number}</Td>
                      <Td label="Kunde">{ladder.company_name ?? '–'}</Td>
                      <Td label="Står på">{ladder.vessel_name ?? ladder.project_name ?? '–'}</Td>
                      <Td>
                        <Link href={`/admin/vedlikehold?leider=${ladder.ladder_id}#ny`} className="pt-btn pt-btn-ghost pt-btn-sm">
                          Velg
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Card>

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
