import Link from 'next/link';
import { requireProduction } from '@/lib/portal/context';
import { jobStatus } from '@/lib/portal/labels';
import { Alert, PageHeader } from '@/components/portal/ui';
import { JobCard, isOverdue, type BoardJob } from '@/components/produksjon/job';
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
    </>
  );
}
