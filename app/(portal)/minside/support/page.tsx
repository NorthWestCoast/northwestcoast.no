import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/portal/context';
import { Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { TICKET_CATEGORIES, ticketStatus } from '@/lib/portal/labels';
import { datoTid } from '@/lib/format';

export const metadata: Metadata = { title: 'Support' };

/** Sakene brukeren (og selskapet) har hos NorthWestCoast. */
export default async function SupportPage() {
  const { supabase } = await requireUser('/minside/support');

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, ticket_number, subject, category, status, last_message_at, contact_name, ladder_id, ladders(serial_number)')
    .order('last_message_at', { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Support"
        description="Spørsmål, reservedeler, service og reklamasjon. Vi svarer i saken, og du får varsel når det kommer svar."
        actions={<Link href="/minside/support/ny" className="pt-btn">Ny sak</Link>}
      />

      <Card flush>
        {tickets && tickets.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Sak</th>
                <th>Emne</th>
                <th>Kategori</th>
                <th>Leider</th>
                <th>Siste aktivitet</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const status = ticketStatus(ticket.status);
                return (
                  <tr key={ticket.id}>
                    <Td label="Sak" className="pt-nowrap">
                      <Link href={`/minside/support/${ticket.id}`}>{ticket.ticket_number}</Link>
                    </Td>
                    <Td label="Emne" className="pt-table-strong">
                      <Link href={`/minside/support/${ticket.id}`}>{ticket.subject}</Link>
                    </Td>
                    <Td label="Kategori">{TICKET_CATEGORIES[ticket.category] ?? ticket.category}</Td>
                    <Td label="Leider">
                      {ticket.ladder_id && ticket.ladders ? (
                        <Link href={`/minside/leider/${ticket.ladder_id}`}>{ticket.ladders.serial_number}</Link>
                      ) : '–'}
                    </Td>
                    <Td label="Siste aktivitet">{datoTid(ticket.last_message_at)}</Td>
                    <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen saker ennå" action={{ href: '/minside/support/ny', label: 'Opprett en sak' }}>
            Lurer du på noe, eller trenger du deler eller service? Send oss en sak.
          </Empty>
        )}
      </Card>
    </>
  );
}
