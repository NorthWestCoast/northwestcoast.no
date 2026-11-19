import Link from 'next/link';
import { requireUser } from '@/lib/portal/context';
import {
  Alert, Badge, Card, Empty, PageHeader, Progress, Stat, Stats, Timeline, type TimelineItem,
} from '@/components/portal/ui';
import { jobStatus, ladderStatus, logKind, orderStatus } from '@/lib/portal/labels';
import type { Tone } from '@/lib/portal/labels';
import { dato, datoTid, fristTekst, idag } from '@/lib/format';
import Onboarding from '@/components/minside/onboarding';
import ServiceState from '@/components/minside/service-state';
import { addDays, daysBetween } from '@/components/minside/util';

type Upcoming = { key: string; iso: string; title: React.ReactNode; text?: string; tone?: Tone };

/**
 * Oversikten: det som krever handling først (forfalt service, forespørsler,
 * leidere som trenger oppfølging), deretter det som kommer, og til slutt
 * bestillinger og varsler.
 */
export default async function MinSidePage() {
  const { supabase, ctx } = await requireUser('/minside');

  if (!ctx.hasAccess && ctx.staffRole === null) {
    return <Onboarding supabase={supabase} ctx={ctx} />;
  }

  const today = idag();
  const in30 = addDays(today, 30);
  const in90 = addDays(today, 90);

  const [
    { data: ladderRows },
    { data: taskRows },
    { count: openTickets },
    { data: requestRows },
    { data: bookingRows },
    { data: orderRows },
    { data: notifications },
    { data: cabinetRows },
  ] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, vessel_id, vessel_name, project_id, project_name, status, service_state, next_service_due, days_until_service, next_task_due, last_service_result')
      .order('next_service_due', { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from('ladder_tasks')
      .select('id, title, kind, due_date, ladder_id')
      .eq('status', 'open')
      .lte('due_date', in90)
      .order('due_date')
      .limit(200),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '(resolved,closed)'),
    supabase
      .from('ladder_access_requests')
      .select('id, requester_name, requester_email, created_at, ladder_id, ladders(serial_number)')
      .eq('status', 'pending')
      .neq('requester_id', ctx.userId)
      .order('created_at')
      .limit(20),
    supabase
      .from('service_bookings')
      .select('id, ladder_id, status, preferred_date, scheduled_date')
      .in('status', ['requested', 'scheduled'])
      .limit(200),
    supabase
      .from('orders')
      .select('id, order_number, status, created_at, expected_delivery, production_jobs(id, status, product_name, serial_number, production_job_steps(done_at))')
      .in('status', ['new', 'quoted', 'confirmed', 'in_production'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('notifications')
      .select('id, title, body, link, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(5),
    // Leverte oppbevaringsskap som ikke står noe sted ennå.
    supabase
      .from('cabinets')
      .select('id, products(name)')
      .eq('status', 'delivered')
      .is('vessel_id', null)
      .is('project_id', null)
      .order('created_at')
      .limit(12),
  ]);

  const ladders = (ladderRows ?? []).filter((l) => l.ladder_id && l.status !== 'retired');
  const serialById = new Map(ladders.map((l) => [l.ladder_id as string, l.serial_number ?? '–']));
  const tasks = taskRows ?? [];
  const requests = requestRows ?? [];
  const bookings = bookingRows ?? [];
  const orders = orderRows ?? [];
  const unplacedCabinets = cabinetRows ?? [];

  const overdue = ladders.filter((l) => l.service_state === 'overdue');
  const dueSoon = ladders.filter((l) => l.service_state === 'due_soon');
  const tasks30 = tasks.filter((t) => t.due_date <= in30);
  const tasksOverdue = tasks30.filter((t) => t.due_date < today);

  // Leidere som trenger at noen gjør noe, med grunnen ved siden av.
  const attention = ladders
    .map((ladder) => {
      const reasons: { label: string; tone: Tone }[] = [];
      if (ladder.last_service_result === 'failed') reasons.push({ label: 'Ikke godkjent ved service', tone: 'danger' });
      if (ladder.status === 'delivered' && !ladder.vessel_id && !ladder.project_id) {
        reasons.push({ label: 'Ikke tatt i bruk', tone: 'info' });
      }
      if (ladder.next_task_due && ladder.next_task_due < today) reasons.push({ label: 'Oppgave forfalt', tone: 'warn' });
      const service = ladder.service_state === 'overdue' || ladder.service_state === 'due_soon';
      return { ladder, reasons, service };
    })
    .filter((row) => row.service || row.reasons.length > 0);

  // Det som kommer de neste 90 dagene, sortert på dato.
  const upcoming: Upcoming[] = [];
  for (const ladder of ladders) {
    if (ladder.next_service_due && ladder.next_service_due >= today && ladder.next_service_due <= in90) {
      upcoming.push({
        key: `service-${ladder.ladder_id}`,
        iso: ladder.next_service_due,
        title: <Link href={`/minside/leider/${ladder.ladder_id}?fane=plan`}>Servicefrist, leider {ladder.serial_number}</Link>,
        text: [ladder.vessel_name ?? ladder.project_name, fristTekst(ladder.days_until_service)].filter(Boolean).join(' · '),
        tone: ladder.service_state === 'due_soon' ? 'warn' : undefined,
      });
    }
  }
  for (const booking of bookings) {
    const iso = booking.status === 'scheduled' ? booking.scheduled_date : booking.preferred_date;
    if (!iso || iso < today || iso > in90) continue;
    upcoming.push({
      key: `booking-${booking.id}`,
      iso,
      title: (
        <Link href={`/minside/leider/${booking.ladder_id}?fane=plan`}>
          {booking.status === 'scheduled' ? 'Avtalt service' : 'Ønsket service'}, leider {serialById.get(booking.ladder_id) ?? '–'}
        </Link>
      ),
      text: booking.status === 'scheduled' ? undefined : 'Venter på bekreftelse fra NorthWest Coast',
      tone: booking.status === 'scheduled' ? 'ok' : 'info',
    });
  }
  for (const task of tasks) {
    const late = task.due_date < today;
    upcoming.push({
      key: `task-${task.id}`,
      iso: task.due_date,
      title: <Link href={`/minside/leider/${task.ladder_id}?fane=plan`}>{task.title}</Link>,
      text: [
        logKind(task.kind),
        `leider ${serialById.get(task.ladder_id) ?? '–'}`,
        late ? fristTekst(daysBetween(today, task.due_date)) : null,
      ].filter(Boolean).join(' · '),
      tone: late ? 'danger' : undefined,
    });
  }
  upcoming.sort((a, b) => a.iso.localeCompare(b.iso));

  const timeline: TimelineItem[] = upcoming.slice(0, 20).map((item) => ({
    key: item.key,
    date: dato(item.iso),
    title: item.title,
    text: item.text,
    tone: item.tone,
    future: true,
  }));

  return (
    <>
      <PageHeader
        title="Oversikt"
        description={`Logget inn som ${ctx.displayName}.`}
        actions={
          <>
            <Link href="/minside/bestill" className="pt-btn">Bestill leider og deler</Link>
            <Link href="/minside/support/ny" className="pt-btn pt-btn-ghost">Kontakt support</Link>
          </>
        }
      />

      <Stats>
        <Stat value={ladders.length} label="Leidere" href="/minside/leidere" />
        <Stat
          value={overdue.length + dueSoon.length}
          label="Service forfalt eller snart"
          tone={overdue.length > 0 ? 'danger' : dueSoon.length > 0 ? 'warn' : 'ok'}
          href="/minside/service"
        />
        <Stat
          value={tasks30.length}
          label="Åpne oppgaver neste 30 dager"
          tone={tasksOverdue.length > 0 ? 'warn' : undefined}
        />
        <Stat
          value={openTickets ?? 0}
          label="Åpne saker"
          tone={(openTickets ?? 0) > 0 ? 'info' : undefined}
          href="/minside/support"
        />
      </Stats>

      {overdue.length > 0 && (
        <Alert
          tone="danger"
          title={overdue.length === 1 ? 'Service er forfalt på 1 leider' : `Service er forfalt på ${overdue.length} leidere`}
        >
          Gjelder {overdue.slice(0, 5).map((l) => l.serial_number).join(', ')}
          {overdue.length > 5 ? ' med flere' : ''}. <Link href="/minside/service">Bestill service</Link> så snart som mulig.
        </Alert>
      )}

      <div className="pt-grid pt-grid-main">
        <div>
          {requests.length > 0 && (
            <Card
              title="Venter på deg"
              description="Noen ber om tilgang til en leider du styrer."
              actions={<Link href="/minside/tilgang" className="pt-btn pt-btn-sm">Behandle</Link>}
              flush
            >
              <ul className="pt-list">
                {requests.map((request) => (
                  <li key={request.id}>
                    <div className="pt-list-main">
                      <Link href="/minside/tilgang">{request.requester_name || request.requester_email || 'Ukjent bruker'}</Link>
                      <div className="pt-list-sub">
                        Ber om tilgang til leider {request.ladders?.serial_number ?? '–'} · {dato(request.created_at)}
                      </div>
                    </div>
                    <div className="pt-list-side"><Badge tone="warn">Venter</Badge></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Trenger oppfølging" flush>
            {attention.length > 0 || unplacedCabinets.length > 0 ? (
              <ul className="pt-list">
                {attention.slice(0, 12).map(({ ladder, reasons, service }) => (
                  <li key={ladder.ladder_id}>
                    <div className="pt-list-main">
                      <Link href={`/minside/leider/${ladder.ladder_id}`}>{ladder.serial_number}</Link>
                      <div className="pt-list-sub">
                        {[ladder.product_name, ladder.vessel_name ?? ladder.project_name ?? ladderStatus(ladder.status).label].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="pt-list-side">
                      {service && (
                        <span>
                          <ServiceState state={ladder.service_state} due={ladder.next_service_due} days={ladder.days_until_service} />
                        </span>
                      )}
                      {reasons.map((reason) => (
                        <Badge key={reason.label} tone={reason.tone}>{reason.label}</Badge>
                      ))}
                    </div>
                  </li>
                ))}
                {unplacedCabinets.map((cabinet) => (
                  <li key={cabinet.id}>
                    <div className="pt-list-main">
                      <Link href="/minside/leidere#skap">{cabinet.products?.name ?? 'Oppbevaringsskap'}</Link>
                      <div className="pt-list-sub">Levert, men står ikke på et fartøy eller i et prosjekt ennå</div>
                    </div>
                    <div className="pt-list-side"><Badge tone="info">Ikke plassert</Badge></div>
                  </li>
                ))}
              </ul>
            ) : ladders.length > 0 ? (
              <Empty title="Alt er à jour">Ingen leidere har forfalt service eller åpne avvik.</Empty>
            ) : (
              <Empty title="Ingen leidere ennå" action={{ href: '/minside/leidere', label: 'Legg til leider' }}>
                Leidere du bestiller dukker opp her når de er produsert. Har du en fra før, legger du den til med produksjonsnummeret.
              </Empty>
            )}
          </Card>

          <Card title="Kommende" description="Servicefrister, avtalt service og oppgaver de neste 90 dagene." flush>
            {timeline.length > 0 ? (
              <Timeline items={timeline} />
            ) : (
              <Empty title="Ingenting planlagt">Ingen frister eller oppgaver de neste 90 dagene.</Empty>
            )}
          </Card>
        </div>

        <div>
          <Card
            title="Bestillinger i arbeid"
            actions={<Link href="/minside/bestillinger" className="pt-link">Alle bestillinger</Link>}
            flush
          >
            {orders.length > 0 ? (
              <ul className="pt-list">
                {orders.map((order) => {
                  const status = orderStatus(order.status);
                  return (
                    <li key={order.id}>
                      <div className="pt-list-main">
                        <Link href="/minside/bestillinger">{order.order_number}</Link>
                        <div className="pt-list-sub">
                          Bestilt {dato(order.created_at)}
                          {order.expected_delivery ? ` · forventet levering ${dato(order.expected_delivery)}` : ''}
                        </div>
                      </div>
                      <div className="pt-list-side"><Badge tone={status.tone}>{status.label}</Badge></div>
                      {order.production_jobs.map((job) => {
                        const done = job.production_job_steps.filter((step) => step.done_at).length;
                        const total = job.production_job_steps.length;
                        return (
                          <div key={job.id} style={{ flexBasis: '100%' }}>
                            <div className="pt-list-sub">
                              {job.product_name}
                              {job.serial_number ? ` · ${job.serial_number}` : ''} · {jobStatus(job.status).label}
                              {total > 0 ? ` · ${done} av ${total} steg` : ''}
                            </div>
                            {total > 0 && <Progress done={done} total={total} />}
                          </div>
                        );
                      })}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="Ingen bestillinger i arbeid" action={{ href: '/minside/bestill', label: 'Bestill leider og deler' }} />
            )}
          </Card>

          <Card
            title="Siste varsler"
            actions={<Link href="/minside/varsler" className="pt-link">Alle varsler</Link>}
            flush
          >
            {notifications && notifications.length > 0 ? (
              <ul className="pt-list">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <div className="pt-list-main">
                      {n.link ? <Link href={n.link}>{n.title}</Link> : <strong>{n.title}</strong>}
                      {n.body && <div className="pt-list-sub">{n.body}</div>}
                      <div className="pt-list-sub">{datoTid(n.created_at)}</div>
                    </div>
                    {!n.read_at && <div className="pt-list-side"><Badge tone="info">Ny</Badge></div>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Ingen varsler ennå" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
