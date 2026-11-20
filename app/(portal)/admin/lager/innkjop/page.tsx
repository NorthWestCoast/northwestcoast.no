import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Badge, Card, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { PURCHASE_KIND, purchaseStatus } from '@/lib/portal/labels';
import { num } from '@/lib/stock';
import { dato, idag } from '@/lib/format';

export const metadata: Metadata = { title: 'Innkjøp' };

const VIEWS = ['apne', 'mottatt', 'alle'] as const;
type View = (typeof VIEWS)[number];

const href = (view: View) => (view === 'apne' ? '/admin/lager/innkjop' : `/admin/lager/innkjop?vis=${view}`);

/**
 * Innkjøpene: det som er bestilt hos leverandører, både vanlige innkjøp og
 * deler som er satt i produksjon hos en ekstern part. Åpne innkjøp står
 * først, med det som er ventet tidligst øverst.
 */
export default async function InnkjopPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string }>;
}) {
  const params = await searchParams;
  const view: View = VIEWS.find((value) => value === params.vis) ?? 'apne';
  const { supabase } = await requireStaff();

  const { data, error } = await supabase
    .from('purchase_orders')
    .select(
      'id, po_number, kind, status, ordered_on, expected_on, reference, suppliers(name), purchase_order_lines(qty_ordered, qty_received)',
    )
    .order('ordered_on', { ascending: false })
    .order('po_number', { ascending: false })
    .limit(1000);

  if (error) console.error('[lager] Kunne ikke hente innkjøpene:', error.message);

  const today = idag();
  const orders = (data ?? []).map(({ purchase_order_lines: lines, ...order }) => ({
    ...order,
    lines: lines.length,
    complete: lines.filter((line) => num(line.qty_received) >= num(line.qty_ordered)).length,
    partial: lines.filter((line) => num(line.qty_received) > 0 && num(line.qty_received) < num(line.qty_ordered)).length,
    late: order.status === 'ordered' && order.expected_on !== null && order.expected_on < today,
  }));

  const open = orders
    .filter((order) => order.status === 'ordered')
    // Det som er ventet først, øverst. Innkjøp uten ventet dato kommer sist.
    .sort((a, b) => (a.expected_on ?? '9999').localeCompare(b.expected_on ?? '9999'));
  const received = orders.filter((order) => order.status === 'received');
  const shown = view === 'apne' ? open : view === 'mottatt' ? received : orders;
  const late = open.filter((order) => order.late).length;

  return (
    <>
      <PageHeader
        title="Innkjøp"
        description="Det som er bestilt hos leverandører: vanlige innkjøp, og deler som er satt i produksjon hos en ekstern part. Varene kommer inn på lager når de registreres som mottatt."
        crumbs={[{ href: '/admin/lager', label: 'Lager' }, { label: 'Innkjøp' }]}
        actions={
          <>
            <Link href="/admin/lager/innkjop/leverandorer" className="pt-btn pt-btn-ghost">Leverandører</Link>
            <Link href="/admin/lager/innkjop/ny" className="pt-btn">Nytt innkjøp</Link>
          </>
        }
      />

      {error && (
        <Alert tone="danger" title="Innkjøpene kunne ikke hentes">Last siden på nytt.</Alert>
      )}

      {late > 0 && (
        <Alert tone="warn" title={late === 1 ? '1 innkjøp er ikke kommet til ventet dato' : `${late} innkjøp er ikke kommet til ventet dato`}>
          De er merket «Forsinket» i lista. Åpne innkjøpet for å registrere mottak eller flytte datoen.
        </Alert>
      )}

      <Tabs
        current={href(view)}
        items={[
          { href: href('apne'), label: `Åpne (${open.length})` },
          { href: href('mottatt'), label: `Mottatt (${received.length})` },
          { href: href('alle'), label: `Alle (${orders.length})` },
        ]}
      />

      <Card flush>
        {shown.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Nummer</th><th>Leverandør og type</th><th>Bestilt</th><th>Ventet</th><th>Mottatt</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((order) => {
                const status = purchaseStatus(order.status);
                return (
                  <tr key={order.id}>
                    <Td label="Nummer" className="pt-table-strong pt-nowrap">
                      <Link href={`/admin/lager/innkjop/${order.id}`} className="pt-mono">{order.po_number}</Link>
                    </Td>
                    {/* Typen står under leverandøren: en egen kolonne ble for trang på små skjermer. */}
                    <Td label="Leverandør">
                      <div>
                        {order.suppliers?.name ?? 'Ikke oppgitt'}
                        <div className="pt-muted">
                          {[PURCHASE_KIND[order.kind] ?? order.kind, order.reference ? `ref. ${order.reference}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    </Td>
                    <Td label="Bestilt" className="pt-nowrap">{dato(order.ordered_on)}</Td>
                    <Td label="Ventet" className="pt-nowrap">
                      <span>
                        {dato(order.expected_on)} {order.late && <Badge tone="danger">Forsinket</Badge>}
                      </span>
                    </Td>
                    <Td label="Mottatt">
                      <div style={{ overflowWrap: 'normal' }}>
                        {order.complete} av {order.lines} {order.lines === 1 ? 'linje' : 'linjer'}
                        {order.partial > 0 && <div className="pt-muted">{order.partial} delvis mottatt</div>}
                      </div>
                    </Td>
                    <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty
            title={
              view === 'apne' ? 'Ingen åpne innkjøp' : view === 'mottatt' ? 'Ingen mottatte innkjøp ennå' : 'Ingen innkjøp ennå'
            }
            action={view === 'mottatt' ? undefined : { href: '/admin/lager/innkjop/ny', label: 'Nytt innkjøp' }}
          >
            {view === 'apne'
              ? 'Alt som er bestilt, er mottatt eller kansellert.'
              : view === 'mottatt'
                ? 'Innkjøp havner her når alle linjene er registrert som mottatt.'
                : 'Opprett et innkjøp når noe er bestilt hos en leverandør.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
