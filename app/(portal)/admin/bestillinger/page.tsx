import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { orderStatus } from '@/lib/portal/labels';
import { dato, nok } from '@/lib/format';
import type { Enums } from '@/lib/supabase/database.types';

const VIEWS: Record<string, { label: string; statuses: Enums<'order_status'>[] | null }> = {
  aktive: { label: 'Aktive', statuses: ['new', 'quoted', 'confirmed', 'in_production'] },
  levert: { label: 'Levert', statuses: ['delivered'] },
  kansellert: { label: 'Kansellert', statuses: ['cancelled'] },
  alle: { label: 'Alle', statuses: null },
};

const href = (view: string) => (view === 'aktive' ? '/admin/bestillinger' : `/admin/bestillinger?vis=${view}`);

export default async function BestillingerPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string }>;
}) {
  const { vis } = await searchParams;
  const view = vis && vis in VIEWS ? vis : 'aktive';
  const { supabase } = await requireStaff();

  let query = supabase
    .from('orders')
    .select('id, order_number, created_at, contact_name, vessel_name, total_nok, status, companies(name), order_lines(qty, on_request)')
    .order('created_at', { ascending: false })
    .limit(200);
  const statuses = VIEWS[view].statuses;
  if (statuses) query = query.in('status', statuses);

  const { data: orders } = await query;

  return (
    <>
      <PageHeader
        title="Bestillinger"
        description="Bestillinger fra nettsiden og Min side. Nye bestillinger bekreftes her og går da til produksjon."
      />

      <Tabs
        current={href(view)}
        items={Object.entries(VIEWS).map(([key, value]) => ({ href: href(key), label: value.label }))}
      />

      <Card flush>
        {orders?.length ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Nr.</th><th>Dato</th><th>Kunde</th><th>Fartøy</th>
                <th className="pt-num">Enheter</th><th className="pt-num">Sum eks. mva</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = orderStatus(order.status);
                const units = order.order_lines.reduce((sum, line) => sum + line.qty, 0);
                const onRequest = order.order_lines.some((line) => line.on_request);
                return (
                  <tr key={order.id}>
                    <Td label="Nr." className="pt-table-strong">
                      <Link href={`/admin/bestillinger/${order.id}`}>{order.order_number}</Link>
                    </Td>
                    <Td label="Dato" className="pt-nowrap">{dato(order.created_at)}</Td>
                    <Td label="Kunde">{order.companies?.name ?? order.contact_name}</Td>
                    <Td label="Fartøy">{order.vessel_name ?? '–'}</Td>
                    <Td label="Enheter" className="pt-num">{units}</Td>
                    <Td label="Sum eks. mva" className="pt-num">
                      {!onRequest
                        ? nok(order.total_nok)
                        : order.total_nok > 0 ? `${nok(order.total_nok)} + forespørsel` : 'På forespørsel'}
                    </Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={view === 'aktive' ? 'Ingen aktive bestillinger' : 'Ingen bestillinger her'} />
        )}
      </Card>
    </>
  );
}
