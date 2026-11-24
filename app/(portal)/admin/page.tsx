import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Empty, PageHeader, Stat, Stats, Td } from '@/components/portal/ui';
import { orderStatus, serviceState, ticketStatusStaff } from '@/lib/portal/labels';
import { dato, datoTid, fristTekst, nok } from '@/lib/format';

/**
 * Oversikten viser det som krever handling, ikke pene totaler: bestillinger
 * som venter, jobber i produksjon, saker, service og rapporter uten leider.
 */
export default async function AdminPage() {
  const { supabase } = await requireStaff();

  const head = { count: 'exact' as const, head: true };
  const soon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    newOrders, inProduction, readyToShip, openTickets, serviceRequests, overdue, unlinked, accessRequests,
    latestOrders, dueSoon, latestTickets,
  ] = await Promise.all([
    supabase.from('orders').select('id', head).eq('status', 'new'),
    supabase.from('production_jobs').select('id', head).in('status', ['queued', 'in_progress']),
    supabase.from('production_jobs').select('id', head).eq('status', 'ready'),
    supabase.from('support_tickets').select('id', head).in('status', ['open', 'in_progress']),
    supabase.from('service_bookings').select('id', head).eq('status', 'requested'),
    supabase.from('ladder_status').select('ladder_id', head).eq('service_state', 'overdue'),
    supabase.from('maintenance_logs').select('id', head).is('ladder_id', null),
    supabase.from('ladder_access_requests').select('id', head).eq('status', 'pending'),
    supabase
      .from('orders')
      .select('id, order_number, created_at, contact_name, vessel_name, total_nok, status, companies(name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, company_name, vessel_name, next_service_due, days_until_service, service_state, booked_service_date')
      .neq('status', 'retired')
      .lte('next_service_due', soon)
      .order('next_service_due', { ascending: true })
      .limit(15),
    supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, status, last_message_at, contact_name, companies(name)')
      .order('last_message_at', { ascending: false })
      .limit(8),
  ]);

  return (
    <>
      <PageHeader title="Oversikt" description="Det som venter på NorthWestCoast akkurat nå." />

      <Stats>
        <Stat value={newOrders.count ?? 0} label="Nye bestillinger" href="/admin/bestillinger" tone={newOrders.count ? 'info' : undefined} />
        <Stat value={inProduction.count ?? 0} label="I produksjon" href="/produksjon" />
        <Stat value={readyToShip.count ?? 0} label="Klar for forsendelse" href="/produksjon" tone={readyToShip.count ? 'ok' : undefined} />
        <Stat value={openTickets.count ?? 0} label="Åpne saker" href="/admin/saker" tone={openTickets.count ? 'warn' : undefined} />
        <Stat value={serviceRequests.count ?? 0} label="Servicebestillinger" href="/admin/service" tone={serviceRequests.count ? 'info' : undefined} />
        <Stat value={overdue.count ?? 0} label="Forfalt service" href="/admin/service#forfaller" tone={overdue.count ? 'danger' : undefined} />
        <Stat value={unlinked.count ?? 0} label="Ukoblede vedlikeholdsrapporter" href="/admin/vedlikehold" tone={unlinked.count ? 'warn' : undefined} />
        <Stat value={accessRequests.count ?? 0} label="Tilgangsforespørsler" href="/admin/tilgang" tone={accessRequests.count ? 'info' : undefined} />
      </Stats>

      <Card
        title="Siste bestillinger"
        actions={<Link href="/admin/bestillinger" className="pt-btn pt-btn-ghost pt-btn-sm">Alle bestillinger</Link>}
        flush
      >
        {latestOrders.data?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Nr.</th><th>Dato</th><th>Kunde</th><th>Fartøy</th><th className="pt-num">Sum</th><th>Status</th></tr>
            </thead>
            <tbody>
              {latestOrders.data.map((order) => {
                const status = orderStatus(order.status);
                return (
                  <tr key={order.id}>
                    <Td label="Nr." className="pt-table-strong">
                      <Link href={`/admin/bestillinger/${order.id}`}>{order.order_number}</Link>
                    </Td>
                    <Td label="Dato" className="pt-nowrap">{dato(order.created_at)}</Td>
                    <Td label="Kunde">{order.companies?.name ?? order.contact_name}</Td>
                    <Td label="Fartøy">{order.vessel_name ?? '–'}</Td>
                    <Td label="Sum" className="pt-num">{nok(order.total_nok)}</Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen bestillinger ennå" />
        )}
      </Card>

      <Card
        title="Service som forfaller de neste 60 dagene"
        description="Forfalt service er et avvik hos kunden, og en anledning til å ta kontakt."
        actions={<Link href="/admin/service" className="pt-btn pt-btn-ghost pt-btn-sm">Service og avtaler</Link>}
        flush
      >
        {dueSoon.data?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Leider</th><th>Kunde</th><th>Fartøy</th><th>Frist</th><th>Status</th></tr>
            </thead>
            <tbody>
              {dueSoon.data.map((row) => {
                const state = serviceState(row.service_state);
                return (
                  <tr key={row.ladder_id}>
                    <Td label="Leider" className="pt-table-strong">
                      <Link href={`/minside/leider/${row.ladder_id}`}>{row.serial_number}</Link>
                    </Td>
                    <Td label="Kunde">{row.company_name ?? '–'}</Td>
                    <Td label="Fartøy">{row.vessel_name ?? '–'}</Td>
                    <Td label="Frist">
                      {dato(row.next_service_due)} ({fristTekst(row.days_until_service)})
                    </Td>
                    <Td label="Status">
                      {row.booked_service_date
                        ? <Badge tone="ok">Avtalt {dato(row.booked_service_date)}</Badge>
                        : <Badge tone={state.tone}>{state.label}</Badge>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen service forfaller de neste 60 dagene" />
        )}
      </Card>

      <Card
        title="Siste saker"
        actions={<Link href="/admin/saker" className="pt-btn pt-btn-ghost pt-btn-sm">Alle saker</Link>}
        flush
      >
        {latestTickets.data?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Nr.</th><th>Emne</th><th>Kunde</th><th>Status</th><th>Siste aktivitet</th></tr>
            </thead>
            <tbody>
              {latestTickets.data.map((ticket) => {
                const status = ticketStatusStaff(ticket.status);
                return (
                  <tr key={ticket.id}>
                    <Td label="Nr." className="pt-nowrap">{ticket.ticket_number}</Td>
                    <Td label="Emne" className="pt-table-strong">
                      <Link href={`/admin/saker/${ticket.id}`}>{ticket.subject}</Link>
                    </Td>
                    <Td label="Kunde">{ticket.companies?.name ?? ticket.contact_name ?? '–'}</Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td label="Siste aktivitet">{datoTid(ticket.last_message_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen saker ennå" />
        )}
      </Card>
    </>
  );
}
