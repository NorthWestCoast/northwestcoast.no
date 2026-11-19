import Link from 'next/link';
import { Alert, Card, KV, Timeline, type TimelineItem } from '@/components/portal/ui';
import { logKind, serviceResult } from '@/lib/portal/labels';
import { dato, fristTekst, idag } from '@/lib/format';
import LadderAdminPanel from '@/components/admin/ladder-admin-panel';
import ServiceState from '@/components/minside/service-state';
import { meter } from '@/components/minside/util';
import type { SectionProps } from './types';

type Event = { iso: string; item: TimelineItem };

const byDate = (a: Event, b: Event) => a.iso.localeCompare(b.iso);

/** Oversikt: spesifikasjoner, snarveier og hele livsløpet på én tidslinje. */
export default async function Oversikt({ supabase, ctx, ladder }: SectionProps) {
  const id = ladder.ladder_id;
  const base = `/minside/leider/${id}`;
  const today = idag();

  const [{ data: services }, { data: logs }, { data: tasks }, { data: bookings }, { data: jobs }] = await Promise.all([
    supabase
      .from('service_reports')
      .select('id, performed_at, performed_by, result')
      .eq('ladder_id', id)
      .order('performed_at', { ascending: false })
      .limit(30),
    supabase
      .from('maintenance_logs')
      .select('id, performed_at, kind, title, reporter_name')
      .eq('ladder_id', id)
      .order('performed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('ladder_tasks')
      .select('id, title, kind, due_date')
      .eq('ladder_id', id)
      .eq('status', 'open')
      .order('due_date')
      .limit(10),
    supabase
      .from('service_bookings')
      .select('id, status, scheduled_date, preferred_date')
      .eq('ladder_id', id)
      .in('status', ['requested', 'scheduled']),
    supabase
      .from('production_jobs')
      .select('id, order_number, shipped_at, delivered_at')
      .eq('ladder_id', id)
      .limit(1),
  ]);

  // ── Det som har skjedd ──
  const past: Event[] = [];
  const job = jobs?.[0];

  if (ladder.produced_at) {
    past.push({
      iso: ladder.produced_at,
      item: { key: 'produced', date: dato(ladder.produced_at), title: 'Produsert', text: ladder.product_name ?? undefined, tone: 'ok' },
    });
  }
  if (job?.delivered_at) {
    past.push({
      iso: job.delivered_at.slice(0, 10),
      item: {
        key: 'delivered',
        date: dato(job.delivered_at),
        title: 'Levert',
        text: job.order_number ? `Bestilling ${job.order_number}` : undefined,
        tone: 'ok',
      },
    });
  }
  if (ladder.installed_at) {
    past.push({
      iso: ladder.installed_at,
      item: {
        key: 'installed',
        date: dato(ladder.installed_at),
        title: ladder.vessel_name ? `Montert på ${ladder.vessel_name}` : 'Montert',
        tone: 'ok',
      },
    });
  }
  for (const report of services ?? []) {
    const result = serviceResult(report.result);
    past.push({
      iso: report.performed_at,
      item: {
        key: `service-${report.id}`,
        date: dato(report.performed_at),
        title: `Service: ${result.label.toLowerCase()}`,
        text: `Utført av ${report.performed_by}`,
        tone: result.tone,
      },
    });
  }
  for (const log of logs ?? []) {
    past.push({
      iso: log.performed_at,
      item: {
        key: `log-${log.id}`,
        date: dato(log.performed_at),
        title: log.title || logKind(log.kind),
        text: [log.title ? logKind(log.kind) : null, log.reporter_name].filter(Boolean).join(' · ') || undefined,
      },
    });
  }
  past.sort(byDate);

  // ── Det som er planlagt ──
  const future: Event[] = [];
  if (ladder.next_service_due) {
    future.push({
      iso: ladder.next_service_due,
      item: {
        key: 'next-service',
        date: dato(ladder.next_service_due),
        title: 'Frist for neste service',
        text: fristTekst(ladder.days_until_service),
        tone: ladder.service_state === 'overdue' ? 'danger' : ladder.service_state === 'due_soon' ? 'warn' : undefined,
        future: true,
      },
    });
  }
  for (const booking of bookings ?? []) {
    const iso = booking.status === 'scheduled' ? booking.scheduled_date : booking.preferred_date;
    future.push({
      iso: iso ?? '9999-12-31',
      item: {
        key: `booking-${booking.id}`,
        date: iso ? dato(iso) : 'Dato ikke avtalt',
        title: booking.status === 'scheduled' ? 'Service er avtalt' : 'Service er bestilt',
        text: booking.status === 'scheduled' ? undefined : 'Venter på bekreftelse fra NorthWest Coast',
        tone: booking.status === 'scheduled' ? 'ok' : 'info',
        future: true,
      },
    });
  }
  for (const task of tasks ?? []) {
    future.push({
      iso: task.due_date,
      item: {
        key: `task-${task.id}`,
        date: dato(task.due_date),
        title: task.title,
        text: `${logKind(task.kind)} · planlagt oppgave${task.due_date < today ? ' · forfalt' : ''}`,
        tone: task.due_date < today ? 'danger' : undefined,
        future: true,
      },
    });
  }
  future.sort(byDate);

  const timeline = [...past, ...future].map((event) => event.item);

  return (
    <>
      {ladder.status === 'delivered' && !ladder.vessel_id && (
        <Alert tone="info" title="Leideren er ikke montert ennå">
          Servicefristen begynner å løpe når leideren er montert på et fartøy.{' '}
          <Link href="/minside/leidere">Monter den under Leidere.</Link>
        </Alert>
      )}

      <div className="pt-actions" style={{ marginBottom: '1.25rem' }}>
        <Link href={`${base}?fane=historikk#ny-logg`} className="pt-btn">Ny loggføring</Link>
        <Link href={`${base}?fane=plan#bestill-service`} className="pt-btn pt-btn-ghost">Bestill service</Link>
        <Link href={`${base}?fane=deling#ny-rapport`} className="pt-btn pt-btn-ghost">Del tilstand med los</Link>
        <Link href={`/minside/support/ny?leider=${id}`} className="pt-btn pt-btn-ghost">Meld en sak</Link>
        {/* Vanlig lenke, ikke klientnavigasjon: nettleseren laster ned filen selv. */}
        <a href={`${base}/pdf`} className="pt-btn pt-btn-ghost">Last ned vedlikeholdslogg (PDF)</a>
      </div>

      <Card title="Spesifikasjoner">
        <KV
          items={[
            { label: 'Produkt', value: ladder.product_name },
            { label: 'Produktnr.', value: ladder.product_number },
            { label: 'Lengde', value: meter(ladder.length_m) },
            { label: 'Trinn', value: ladder.steps },
            { label: 'Produsert', value: dato(ladder.produced_at) },
            { label: 'Installert', value: dato(ladder.installed_at) },
            {
              label: 'Fartøy',
              value: ladder.vessel_id
                ? <Link href={`/minside/fartoy/${ladder.vessel_id}`}>{ladder.vessel_name ?? 'Fartøy'}</Link>
                : 'Ikke montert',
            },
            { label: 'Eier', value: ladder.company_name },
            {
              label: 'Serviceintervall',
              value: ladder.service_interval_months ? `${ladder.service_interval_months} måneder` : null,
            },
            { label: 'Siste service', value: dato(ladder.last_service_at) },
            {
              label: 'Neste service',
              value: <ServiceState state={ladder.service_state} due={ladder.next_service_due} days={ladder.days_until_service} />,
            },
            { label: 'Åpne oppgaver', value: ladder.open_tasks ?? 0 },
          ]}
        />
      </Card>

      <Card
        title="Livsløp"
        description="Fra produksjon til i dag, og det som er planlagt framover (stiplet linje)."
        actions={<Link href={`${base}?fane=historikk`} className="pt-link">Hele historikken</Link>}
        flush
      >
        {timeline.length > 0 ? (
          <Timeline items={timeline} />
        ) : (
          <p className="pt-hint" style={{ padding: '1.1rem' }}>Ingenting er registrert på leideren ennå.</p>
        )}
      </Card>

      {ctx.staffRole === 'admin' && <LadderAdminPanel ladderId={id} />}
    </>
  );
}
