import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Badge, Card, Empty, KV, PageHeader } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Hidden, Select, Textarea } from '@/components/admin/fields';
import { TICKET_CATEGORIES, ticketStatusStaff } from '@/lib/portal/labels';
import { datoTid } from '@/lib/format';
import { replyTicket, setTicketDetails, setTicketStatus } from '../actions';

const STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const PRIORITIES: Record<string, string> = { low: 'Lav', normal: 'Normal', high: 'Høy' };

export default async function SakPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase, ctx } = await requireStaff();

  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, category, status, priority, created_at, contact_name, contact_email, ladder_id, companies(id, name), ladders(serial_number)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('ticket_messages')
      .select('id, author_id, author_name, from_staff, body, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
  ]);
  if (!ticket) notFound();

  const status = ticketStatusStaff(ticket.status);
  const ticketId = { ticket_id: ticket.id };

  return (
    <>
      <PageHeader
        title={ticket.subject}
        crumbs={[{ href: '/admin/saker', label: 'Saker' }, { label: ticket.ticket_number }]}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        description={`${ticket.ticket_number}, opprettet ${datoTid(ticket.created_at)}.`}
      />

      <Card title="Om saken">
        <KV
          items={[
            { label: 'Kontakt', value: ticket.contact_name ?? '–' },
            {
              label: 'E-post',
              value: ticket.contact_email ? <a href={`mailto:${ticket.contact_email}`}>{ticket.contact_email}</a> : '–',
            },
            {
              label: 'Selskap',
              value: ticket.companies
                ? <Link href={`/admin/selskap/${ticket.companies.id}`}>{ticket.companies.name}</Link>
                : '–',
            },
            {
              label: 'Leider',
              value: ticket.ladder_id
                ? <Link href={`/minside/leider/${ticket.ladder_id}`}>{ticket.ladders?.serial_number ?? 'Åpne'}</Link>
                : '–',
            },
          ]}
        />
      </Card>

      <div className="pt-grid pt-grid-main">
        <div>
          <Card title="Samtale" flush>
            {messages?.length ? (
              <div className="pt-thread">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="pt-bubble"
                    data-staff={message.from_staff ? 'true' : undefined}
                    data-mine={message.author_id === ctx.userId ? 'true' : undefined}
                  >
                    <div className="pt-bubble-head">
                      <strong>{message.author_name ?? (message.from_staff ? 'NorthWest Coast' : 'Kunde')}</strong>
                      <span>{datoTid(message.created_at)}</span>
                    </div>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="Ingen meldinger i saken" />
            )}
          </Card>

          <Card title="Svar kunden" description="Kunden får varsel, og saken settes til «Venter på kunde».">
            <PortalForm action={replyTicket} submitLabel="Send svar" pendingLabel="Sender…">
              <Hidden fields={ticketId} />
              <Textarea name="body" label="Svar" required rows={5} maxLength={5000} />
            </PortalForm>
          </Card>
        </div>

        <div>
          <Card title="Status">
            <PortalForm action={setTicketStatus} submitLabel="Lagre status" resetOnSuccess={false}>
              <Hidden fields={ticketId} />
              <Select name="status" label="Status" defaultValue={ticket.status}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>{ticketStatusStaff(value).label}</option>
                ))}
              </Select>
              <p className="pt-hint">Kunden får varsel når saken settes til løst eller lukket.</p>
            </PortalForm>
          </Card>

          <Card title="Prioritet og kategori">
            <PortalForm action={setTicketDetails} submitLabel="Lagre" resetOnSuccess={false}>
              <Hidden fields={ticketId} />
              <Select name="priority" label="Prioritet" defaultValue={ticket.priority}>
                {Object.entries(PRIORITIES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select name="category" label="Kategori" defaultValue={ticket.category}>
                {Object.entries(TICKET_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </PortalForm>
          </Card>
        </div>
      </div>
    </>
  );
}
