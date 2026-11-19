import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { TICKET_CATEGORIES, type Tone, ticketStatusStaff } from '@/lib/portal/labels';
import { datoTid } from '@/lib/format';

const VIEWS: Record<string, { label: string; statuses: string[] | null }> = {
  apne: { label: 'Åpne', statuses: ['open', 'in_progress'] },
  venter: { label: 'Venter på kunde', statuses: ['waiting_customer'] },
  lost: { label: 'Løst', statuses: ['resolved', 'closed'] },
  alle: { label: 'Alle', statuses: null },
};

const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  low: { label: 'Lav', tone: 'neutral' },
  normal: { label: 'Normal', tone: 'neutral' },
  high: { label: 'Høy', tone: 'danger' },
};

const href = (view: string) => (view === 'apne' ? '/admin/saker' : `/admin/saker?vis=${view}`);

export default async function SakerPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string }>;
}) {
  const { vis } = await searchParams;
  const view = vis && vis in VIEWS ? vis : 'apne';
  const { supabase } = await requireStaff();

  let query = supabase
    .from('support_tickets')
    .select('id, ticket_number, subject, category, status, priority, last_message_at, contact_name, companies(name)')
    .order('last_message_at', { ascending: false })
    .limit(200);
  const statuses = VIEWS[view].statuses;
  if (statuses) query = query.in('status', statuses);

  const { data: tickets } = await query;

  return (
    <>
      <PageHeader title="Saker" description="Spørsmål, reklamasjoner og andre saker kundene har meldt fra Min side." />

      <Tabs
        current={href(view)}
        items={Object.entries(VIEWS).map(([key, value]) => ({ href: href(key), label: value.label }))}
      />

      <Card flush>
        {tickets?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Nr.</th><th>Emne</th><th>Kunde</th><th>Kategori</th><th>Status</th><th>Prioritet</th><th>Siste aktivitet</th></tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const status = ticketStatusStaff(ticket.status);
                const priority = PRIORITY[ticket.priority] ?? PRIORITY.normal;
                return (
                  <tr key={ticket.id}>
                    <Td label="Nr." className="pt-nowrap">{ticket.ticket_number}</Td>
                    <Td label="Emne" className="pt-table-strong">
                      <Link href={`/admin/saker/${ticket.id}`}>{ticket.subject}</Link>
                    </Td>
                    <Td label="Kunde">{ticket.companies?.name ?? ticket.contact_name ?? '–'}</Td>
                    <Td label="Kategori">{TICKET_CATEGORIES[ticket.category] ?? ticket.category}</Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td label="Prioritet"><Badge tone={priority.tone}>{priority.label}</Badge></Td>
                    <Td label="Siste aktivitet">{datoTid(ticket.last_message_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={view === 'apne' ? 'Ingen åpne saker' : 'Ingen saker her'} />
        )}
      </Card>
    </>
  );
}
