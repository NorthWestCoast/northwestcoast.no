import { Badge, Card, Disclosure, Empty, KV } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { LOG_KINDS, bookingStatus, logKind } from '@/lib/portal/labels';
import { dato, fristTekst, idag } from '@/lib/format';
import { ServiceRequestForm } from '@/components/minside/forms';
import ServiceState from '@/components/minside/service-state';
import { daysBetween, gjentasTekst } from '@/components/minside/util';
import { cancelServiceBooking, requestService } from '@/app/(portal)/minside/actions';
import { completeTask, createTask, deleteTask } from '../actions';
import type { SectionProps } from './types';

/** Service og oppgaver: neste frist, servicebestillinger og planlagte oppgaver. */
export default async function Plan({ supabase, ctx, ladder, canManage }: SectionProps) {
  const id = ladder.ladder_id;
  const today = idag();

  const [{ data: bookings }, { data: tasks }] = await Promise.all([
    supabase
      .from('service_bookings')
      .select('id, status, preferred_date, scheduled_date, location, notes, technician, staff_note, requester_name, created_at')
      .eq('ladder_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('ladder_tasks')
      .select('id, title, kind, description, due_date, recurrence_months, status, completed_at, created_by')
      .eq('ladder_id', id)
      .in('status', ['open', 'done'])
      .order('due_date')
      .limit(200),
  ]);

  const openTasks = (tasks ?? []).filter((task) => task.status === 'open');
  const doneTasks = (tasks ?? [])
    .filter((task) => task.status === 'done')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, 30);
  const hasOpenBooking = (bookings ?? []).some((b) => b.status === 'requested');

  return (
    <>
      <Card title="Neste service">
        <KV
          items={[
            {
              label: 'Status',
              value: <ServiceState state={ladder.service_state} />,
            },
            {
              label: 'Frist',
              value: ladder.next_service_due
                ? `${dato(ladder.next_service_due)} (${fristTekst(ladder.days_until_service)})`
                : 'Ingen frist før leideren er montert',
            },
            {
              label: 'Intervall',
              value: ladder.service_interval_months ? `${ladder.service_interval_months} måneder` : null,
            },
            { label: 'Siste service', value: dato(ladder.last_service_at) },
            { label: 'Avtalt service', value: ladder.booked_service_date ? dato(ladder.booked_service_date) : 'Ikke avtalt' },
          ]}
        />
      </Card>

      <Card title="Servicebestillinger" flush>
        {bookings && bookings.length > 0 ? (
          <ul className="pt-list">
            {bookings.map((booking) => {
              const status = bookingStatus(booking.status);
              const open = booking.status === 'requested' || booking.status === 'scheduled';
              return (
                <li key={booking.id}>
                  <div className="pt-list-main">
                    <strong>
                      {booking.scheduled_date
                        ? `Avtalt ${dato(booking.scheduled_date)}`
                        : booking.preferred_date
                          ? `Ønsket ${dato(booking.preferred_date)}`
                          : 'Dato ikke avtalt'}
                    </strong>
                    <div className="pt-list-sub">
                      {[
                        booking.location,
                        booking.technician ? `Tekniker: ${booking.technician}` : null,
                        `Bestilt ${dato(booking.created_at)}${booking.requester_name ? ` av ${booking.requester_name}` : ''}`,
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {booking.notes && <div className="pt-list-sub">Kommentar: {booking.notes}</div>}
                    {booking.staff_note && <div className="pt-list-sub">Fra NorthWestCoast: {booking.staff_note}</div>}
                  </div>
                  <div className="pt-list-side">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {open && (
                      <ActionButton
                        action={cancelServiceBooking}
                        fields={{ booking_id: booking.id }}
                        label="Avbestill"
                        tone="danger"
                        confirm="Avbestille servicen?"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="Ingen servicebestillinger">Bestill service i skjemaet under når det nærmer seg frist.</Empty>
        )}
      </Card>

      <Card
        id="bestill-service"
        title="Bestill service"
        description={
          hasOpenBooking
            ? 'Det ligger allerede en bestilling som venter på bekreftelse. Avbestill den først hvis du vil endre.'
            : 'NorthWestCoast tar kontakt for å avtale tidspunkt og sted.'
        }
      >
        {!hasOpenBooking && (
          <ServiceRequestForm
            action={requestService}
            ladders={[{ id, label: ladder.serial_number ?? 'Leider' }]}
            minDate={today}
          />
        )}
      </Card>

      <Card
        title="Oppgaver"
        description="Egne kontroller og vedlikehold dere planlegger selv. Fullførte oppgaver havner i historikken."
        flush
      >
        {openTasks.length > 0 ? (
          <ul className="pt-list">
            {openTasks.map((task) => {
              const late = task.due_date < today;
              const canDelete = canManage || task.created_by === ctx.userId;
              return (
                <li key={task.id}>
                  <div className="pt-list-main">
                    <strong>{task.title}</strong>
                    <div className="pt-list-sub">
                      {[
                        logKind(task.kind),
                        `frist ${dato(task.due_date)}`,
                        gjentasTekst(task.recurrence_months),
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {task.description && <div className="pt-list-sub">{task.description}</div>}
                  </div>
                  <div className="pt-list-side">
                    {late ? (
                      <Badge tone="danger">{fristTekst(daysBetween(today, task.due_date))}</Badge>
                    ) : (
                      <Badge tone="neutral">{fristTekst(daysBetween(today, task.due_date))}</Badge>
                    )}
                    {canDelete && (
                      <ActionButton
                        action={deleteTask}
                        fields={{ task_id: task.id }}
                        label="Slett"
                        tone="danger"
                        confirm={`Slette oppgaven «${task.title}»?`}
                      />
                    )}
                  </div>
                  <div style={{ flexBasis: '100%', margin: '0 -1.1rem -0.8rem' }}>
                    <Disclosure summary="Fullfør">
                      <PortalForm action={completeTask} submitLabel="Fullfør og loggfør" tone="green">
                        <input type="hidden" name="task_id" value={task.id} />
                        <div className="pt-field">
                          <label htmlFor={`done-${task.id}`}>Utført dato</label>
                          <input id={`done-${task.id}`} name="performed_at" type="date" defaultValue={today} max={today} required />
                        </div>
                        <div className="pt-field">
                          <label htmlFor={`notes-${task.id}`}>Notat (valgfritt)</label>
                          <textarea id={`notes-${task.id}`} name="notes" maxLength={4000} placeholder="Hva ble gjort, og hva ble funnet?" />
                        </div>
                      </PortalForm>
                    </Disclosure>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="Ingen åpne oppgaver">Legg inn egenkontroller og annet som skal gjøres til faste tider.</Empty>
        )}

        <Disclosure summary="Ny oppgave">
          <PortalForm action={createTask} submitLabel="Legg til oppgave">
            <input type="hidden" name="ladder_id" value={id} />
            <div className="pt-field">
              <label htmlFor="task-title">Hva skal gjøres?</label>
              <input id="task-title" name="title" required minLength={2} maxLength={160} placeholder="F.eks. Halvårlig egenkontroll" />
            </div>
            <div className="pt-form-row pt-form-row-3">
              <div className="pt-field">
                <label htmlFor="task-kind">Type</label>
                <select id="task-kind" name="kind" defaultValue="inspection" required>
                  {Object.entries(LOG_KINDS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="pt-field">
                <label htmlFor="task-due">Frist</label>
                <input id="task-due" name="due_date" type="date" required />
              </div>
              <div className="pt-field">
                <label htmlFor="task-recurrence">Gjentas hver N. måned (valgfritt)</label>
                <input id="task-recurrence" name="recurrence_months" type="number" inputMode="numeric" min={1} max={120} placeholder="F.eks. 6" />
              </div>
            </div>
            <div className="pt-field">
              <label htmlFor="task-description">Beskrivelse (valgfritt)</label>
              <textarea id="task-description" name="description" maxLength={1000} />
            </div>
          </PortalForm>
        </Disclosure>

        {doneTasks.length > 0 && (
          <Disclosure summary={`Fullførte oppgaver (${doneTasks.length})`}>
            <ul className="pt-list" style={{ margin: '0 -1.1rem' }}>
              {doneTasks.map((task) => (
                <li key={task.id}>
                  <div className="pt-list-main">
                    <strong>{task.title}</strong>
                    <div className="pt-list-sub">
                      {logKind(task.kind)} · fullført {dato(task.completed_at)}
                    </div>
                  </div>
                  <div className="pt-list-side"><Badge tone="ok">Fullført</Badge></div>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </Card>
    </>
  );
}
