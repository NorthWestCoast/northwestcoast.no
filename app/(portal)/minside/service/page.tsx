import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/portal/context';
import { Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import { bookingStatus } from '@/lib/portal/labels';
import { dato, idag } from '@/lib/format';
import { ServiceRequestForm } from '@/components/minside/forms';
import ServiceState from '@/components/minside/service-state';
import { cancelServiceBooking, requestService } from '../actions';

export const metadata: Metadata = { title: 'Service' };

/** Service på tvers av leiderne: hva som forfaller, og hva som er bestilt. */
export default async function ServicePage() {
  const { supabase } = await requireUser('/minside/service');

  const [{ data: ladderRows }, { data: bookings }] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, vessel_name, status, service_state, next_service_due, days_until_service, booked_service_date')
      .order('next_service_due', { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from('service_bookings')
      .select('id, ladder_id, status, preferred_date, scheduled_date, location, technician, staff_note, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const ladders = (ladderRows ?? []).filter((l) => l.ladder_id && l.status !== 'retired');
  const serialById = new Map(ladders.map((l) => [l.ladder_id as string, l.serial_number ?? '–']));
  const due = ladders.filter((l) => l.service_state === 'overdue' || l.service_state === 'due_soon');
  const waiting = new Set((bookings ?? []).filter((b) => b.status === 'requested').map((b) => b.ladder_id));

  // Leidere uten en ubehandlet bestilling kan bestilles på.
  const bookable = ladders
    .filter((l) => l.status !== 'in_production' && !waiting.has(l.ladder_id as string))
    .map((l) => ({
      id: l.ladder_id as string,
      label: [l.serial_number, l.vessel_name].filter(Boolean).join(' · '),
    }));

  return (
    <>
      <PageHeader
        title="Service"
        description="Fagmessig service utføres av NorthWest Coast. Bestill i god tid før fristen."
      />

      <Card title="Forfaller snart eller er forfalt" flush>
        {due.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Leider</th>
                <th>Fartøy</th>
                <th>Service</th>
                <th>Avtalt</th>
              </tr>
            </thead>
            <tbody>
              {due.map((ladder) => (
                <tr key={ladder.ladder_id}>
                  <Td label="Leider" className="pt-table-strong">
                    <Link href={`/minside/leider/${ladder.ladder_id}?fane=plan`}>{ladder.serial_number}</Link>
                  </Td>
                  <Td label="Fartøy">{ladder.vessel_name ?? '–'}</Td>
                  <Td label="Service">
                    <div>
                      <ServiceState state={ladder.service_state} due={ladder.next_service_due} days={ladder.days_until_service} />
                    </div>
                  </Td>
                  <Td label="Avtalt">
                    {ladder.booked_service_date
                      ? dato(ladder.booked_service_date)
                      : waiting.has(ladder.ladder_id as string) ? 'Bestilt, venter på dato' : 'Ikke bestilt'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen leidere har service som forfaller de neste 30 dagene" />
        )}
      </Card>

      <Card
        title="Bestill service"
        description="NorthWest Coast tar kontakt for å avtale tidspunkt og sted."
      >
        {bookable.length > 0 ? (
          <ServiceRequestForm action={requestService} ladders={bookable} minDate={idag()} />
        ) : (
          <p className="pt-hint">
            {ladders.length === 0
              ? 'Du har ingen leidere å bestille service på ennå.'
              : 'Alle leiderne dine har allerede en bestilling som venter på bekreftelse.'}
          </p>
        )}
      </Card>

      <Card title="Servicebestillinger" flush>
        {bookings && bookings.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Leider</th>
                <th>Bestilt</th>
                <th>Ønsket dato</th>
                <th>Avtalt dato</th>
                <th>Sted</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const status = bookingStatus(booking.status);
                const open = booking.status === 'requested' || booking.status === 'scheduled';
                return (
                  <tr key={booking.id}>
                    <Td label="Leider" className="pt-table-strong">
                      <Link href={`/minside/leider/${booking.ladder_id}?fane=plan`}>
                        {serialById.get(booking.ladder_id) ?? 'Leider'}
                      </Link>
                    </Td>
                    <Td label="Bestilt">{dato(booking.created_at)}</Td>
                    <Td label="Ønsket dato">{dato(booking.preferred_date)}</Td>
                    <Td label="Avtalt dato">
                      {dato(booking.scheduled_date)}
                      {booking.technician ? ` · ${booking.technician}` : ''}
                    </Td>
                    <Td label="Sted">{booking.location ?? '–'}</Td>
                    <Td label="Status">
                      <div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {booking.staff_note && <div className="pt-list-sub">{booking.staff_note}</div>}
                      </div>
                    </Td>
                    <Td>
                      {open && (
                        <ActionButton
                          action={cancelServiceBooking}
                          fields={{ booking_id: booking.id }}
                          label="Avbestill"
                          tone="danger"
                          confirm="Avbestille servicen?"
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen servicebestillinger ennå" />
        )}
      </Card>
    </>
  );
}
