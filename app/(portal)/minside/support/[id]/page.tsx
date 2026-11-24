import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/portal/context';
import { Badge, Card, PageHeader } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { uuid } from '@/lib/portal/forms';
import { TICKET_CATEGORIES, ticketStatus } from '@/lib/portal/labels';
import { datoTid } from '@/lib/format';
import { replyTicket, setTicketStatus } from '../actions';

export const metadata: Metadata = { title: 'Sak' };

/** Én sak: hele tråden, svarfelt og lukk/gjenåpne. */
export default async function SakPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase, ctx } = await requireUser(`/minside/support/${id}`);

  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, category, status, created_at, ladder_id, ladders(serial_number)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('ticket_messages')
      .select('id, author_id, author_name, from_staff, body, created_at')
      .eq('ticket_id', id)
      .order('created_at'),
  ]);
  if (!ticket) notFound();

  const status = ticketStatus(ticket.status);
  const closed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <>
      <PageHeader
        title={ticket.subject}
        description={[
          ticket.ticket_number,
          TICKET_CATEGORIES[ticket.category] ?? ticket.category,
          `opprettet ${datoTid(ticket.created_at)}`,
        ].join(' · ')}
        crumbs={[{ href: '/minside/support', label: 'Support' }, { label: ticket.ticket_number }]}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        actions={
          <ActionButton
            action={setTicketStatus}
            fields={{ ticket_id: ticket.id, status: closed ? 'open' : 'closed' }}
            label={closed ? 'Åpne igjen' : 'Lukk saken'}
            size="md"
            confirm={closed ? undefined : 'Lukke saken? Du kan åpne den igjen senere.'}
          />
        }
      />

      {ticket.ladder_id && ticket.ladders && (
        <p className="pt-hint" style={{ marginBottom: '1rem' }}>
          Gjelder leider <Link href={`/minside/leider/${ticket.ladder_id}`}>{ticket.ladders.serial_number}</Link>
        </p>
      )}

      <Card flush>
        <div className="pt-thread">
          {(messages ?? []).map((message) => (
            <div
              key={message.id}
              className="pt-bubble"
              data-staff={message.from_staff ? 'true' : undefined}
              data-mine={message.author_id === ctx.userId ? 'true' : undefined}
            >
              <div className="pt-bubble-head">
                <strong>
                  {message.from_staff
                    ? `${message.author_name ?? 'NorthWestCoast'} (NorthWestCoast)`
                    : message.author_name ?? 'Kunde'}
                </strong>
                <span>{datoTid(message.created_at)}</span>
              </div>
              <p>{message.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={closed ? 'Skriv for å åpne saken igjen' : 'Svar'}>
        <PortalForm action={replyTicket} submitLabel="Send" pendingLabel="Sender…">
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <div className="pt-field">
            <label htmlFor="reply-body">Melding</label>
            <textarea id="reply-body" name="body" required maxLength={5000} />
          </div>
        </PortalForm>
      </Card>
    </>
  );
}
