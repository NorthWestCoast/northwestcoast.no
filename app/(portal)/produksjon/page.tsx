import Link from 'next/link';
import { requireProduction } from '@/lib/portal/context';
import { jobStatus } from '@/lib/portal/labels';
import { Alert, Card, PageHeader, Td } from '@/components/portal/ui';
import { JobCard, JobKindBadge, datoOslo, isCabinetJob, isOverdue, meter, type BoardJob } from '@/components/produksjon/job';
import { idag } from '@/lib/format';

const COLUMNS = [
  { status: 'queued', empty: 'Ingen jobber i kø.' },
  { status: 'in_progress', empty: 'Ingen jobber er påbegynt.' },
  { status: 'ready', empty: 'Ingen jobber venter på forsendelse.' },
  { status: 'shipped', empty: 'Ingen jobber er på vei til kunde.' },
] as const;

/**
 * Tavla: alle jobber som ikke er avsluttet, fordelt på hvor langt de er
 * kommet. Kolonnene står ved siden av hverandre på store skjermer og under
 * hverandre på telefon.
 *
 * Enheter som er bygget uten bestilling og lagt på lager, er ferdige jobber
 * og står ikke i kolonnene. De vises i en egen liste under tavla, fordi de
 * fortsatt står i lokalet og kan brukes når en bestilling kommer.
 */
export default async function ProduksjonPage() {
  const { supabase, ctx } = await requireProduction();

  const { data, error } = await supabase
    .from('production_jobs')
    .select(
      'id, job_number, kind, status, due_date, product_name, product_number, length_m, steps, with_cabinet, customer_label, vessel_name, serial_number, shipped_at, production_job_steps(done_at)',
    )
    .in('status', COLUMNS.map((column) => column.status))
    // Nærmeste frist først. Jobber uten frist kommer sist, eldste først.
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) console.error('[produksjon] Kunne ikke hente jobbene:', error.message);

  const { data: shelf, error: shelfError } = await supabase
    .from('production_jobs')
    .select('id, job_number, kind, product_name, product_number, length_m, steps, serial_number, completed_at')
    .eq('status', 'stocked')
    // Eldste først: det som har stått lengst, bør selges først.
    .order('completed_at', { ascending: true, nullsFirst: false })
    .limit(500);

  if (shelfError) console.error('[produksjon] Kunne ikke hente enhetene på lager:', shelfError.message);

  const jobs: BoardJob[] = (data ?? []).map(({ production_job_steps: steps, ...job }) => ({
    ...job,
    done: steps.filter((step) => step.done_at !== null).length,
    total: steps.length,
  }));

  const today = idag();
  const overdue = jobs.filter((job) => isOverdue(job, today)).length;

  return (
    <>
      <PageHeader
        title="Produksjon"
        description="Leidere og oppbevaringsskap som skal produseres. Åpne en jobb for å se spesifikasjonen, kvittere ut steg og registrere produksjonsnummeret."
        actions={
          ctx.staffRole === 'admin' && <Link href="/produksjon/ny" className="pt-btn">Ny jobb</Link>
        }
      />

      {error && (
        <Alert tone="danger" title="Jobbene kunne ikke hentes">
          Last siden på nytt. Gi beskjed til en administrator hvis det fortsetter.
        </Alert>
      )}

      {overdue > 0 && (
        <Alert tone="warn" title={overdue === 1 ? '1 jobb er over fristen' : `${overdue} jobber er over fristen`}>
          Fristen er merket med rødt på kortet.
        </Alert>
      )}

      <div className="pt-board">
        {COLUMNS.map((column) => {
          const inColumn = jobs.filter((job) => job.status === column.status);
          // Sendt: det som sist forlot produksjonen øverst.
          if (column.status === 'shipped') {
            inColumn.sort((a, b) => (b.shipped_at ?? '').localeCompare(a.shipped_at ?? ''));
          }

          return (
            <section key={column.status} className="pt-board-col" aria-label={jobStatus(column.status).label}>
              <h2>
                <span>{jobStatus(column.status).label}</span>
                <span>{inColumn.length}</span>
              </h2>
              {inColumn.length > 0 ? (
                inColumn.map((job) => <JobCard key={job.id} job={job} today={today} />)
              ) : (
                <p className="pt-hint" style={{ padding: '0.2rem 0.4rem 0.5rem' }}>{column.empty}</p>
              )}
            </section>
          );
        })}
      </div>

      {(shelf ?? []).length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <Card
            title={`På lager (${shelf?.length ?? 0})`}
            description="Ferdige enheter som er bygget uten bestilling. Når en bestilling på samme produkt og lengde er bekreftet, åpner du jobben den opprettet og velger «Hent fra lager»."
            flush
          >
            <table className="pt-table">
              <thead>
                <tr><th>Jobb</th><th>Produkt</th><th>Produksjonsnummer</th><th>Ferdig</th></tr>
              </thead>
              <tbody>
                {(shelf ?? []).map((unit) => (
                  <tr key={unit.id}>
                    <Td label="Jobb" className="pt-table-strong pt-nowrap">
                      <Link href={`/produksjon/${unit.id}`}>{unit.job_number}</Link>
                    </Td>
                    <Td label="Produkt">
                      <div>
                        {unit.product_name} <JobKindBadge job={unit} />
                        <div className="pt-muted">
                          {isCabinetJob(unit)
                            ? 'Oppbevaringsskap'
                            : [meter(unit.length_m), unit.steps ? `${unit.steps} trinn` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </Td>
                    <Td label="Produksjonsnummer">
                      {unit.serial_number ? <span className="pt-mono">{unit.serial_number}</span> : '–'}
                    </Td>
                    <Td label="Ferdig" className="pt-nowrap">{datoOslo(unit.completed_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
