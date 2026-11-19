import Link from 'next/link';
import { Badge, Progress } from '@/components/portal/ui';
import { dato } from '@/lib/format';

/**
 * Felles visning av en produksjonsjobb. Alt som står her kommer fra
 * production_jobs: spesifikasjonen kopieres dit når jobben opprettes, så
 * produksjon trenger verken bestillingene eller kunderegisteret.
 */

type Spec = {
  length_m: number | null;
  steps: number | null;
  with_cabinet: boolean;
};

export const meter = (value: number | null) =>
  value === null ? '–' : `${Number(value).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} m`;

/** «6 m · 19 trinn · med oppbevaringsskap». */
export function specLine(job: Spec): string {
  return [
    job.length_m !== null ? meter(job.length_m) : null,
    job.steps ? `${job.steps} trinn` : null,
    job.with_cabinet ? 'med oppbevaringsskap' : 'uten oppbevaringsskap',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Dato i norsk tid for et tidspunkt (sendt, levert). */
export function datoOslo(value: string | null | undefined): string {
  if (!value) return '–';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '–'
    : parsed.toLocaleDateString('nb-NO', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo',
      });
}

/** Fristen er passert, og jobben har ikke forlatt produksjonen. */
export function isOverdue(job: { due_date: string | null; status: string }, today: string): boolean {
  return Boolean(job.due_date)
    && (job.due_date as string) < today
    && ['queued', 'in_progress', 'ready'].includes(job.status);
}

export type BoardJob = Spec & {
  id: string;
  job_number: string;
  status: string;
  due_date: string | null;
  product_name: string;
  customer_label: string | null;
  vessel_name: string | null;
  serial_number: string | null;
  shipped_at: string | null;
  done: number;
  total: number;
};

/** Kortet på tavla. Hele kortet er en lenke til jobben. */
export function JobCard({ job, today }: { job: BoardJob; today: string }) {
  const overdue = isOverdue(job, today);

  return (
    <Link href={`/produksjon/${job.id}`} className="pt-job">
      <div className="pt-job-top">
        <span>{job.job_number}</span>
        {job.status === 'shipped' ? (
          <span>Sendt {datoOslo(job.shipped_at)}</span>
        ) : overdue ? (
          <Badge tone="danger">Frist {dato(job.due_date)}</Badge>
        ) : (
          <span>{job.due_date ? `Frist ${dato(job.due_date)}` : 'Ingen frist'}</span>
        )}
      </div>
      <div className="pt-job-title">{job.product_name}</div>
      <div className="pt-job-spec">
        <div>{specLine(job)}</div>
        <div>{[job.customer_label, job.vessel_name].filter(Boolean).join(' · ') || 'Kunde ikke oppgitt'}</div>
        {job.serial_number && <div className="pt-mono">Prod.nr. {job.serial_number}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div style={{ flex: 1 }}>
          <Progress done={job.done} total={job.total} />
        </div>
        <span className="pt-mono pt-muted" style={{ flex: 'none', fontSize: '0.74rem' }}>
          {job.done}/{job.total}
        </span>
      </div>
    </Link>
  );
}
