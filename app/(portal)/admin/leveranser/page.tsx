import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import { dato } from '@/lib/format';
import { markDelivered } from '../bestillinger/actions';

const VIEWS: Record<string, string> = {
  alle: 'Alle',
  underveis: 'Underveis',
  levert: 'Levert',
};

const href = (view: string) => (view === 'alle' ? '/admin/leveranser' : `/admin/leveranser?vis=${view}`);

/**
 * Alle leveranser, nyeste først. Leveranser for leidere opprettes når
 * produksjon sender jobben; andre registreres på bestillingen.
 */
export default async function LeveranserPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string }>;
}) {
  const { vis } = await searchParams;
  const view = vis && vis in VIEWS ? vis : 'alle';
  const { supabase } = await requireStaff();

  let query = supabase
    .from('deliveries')
    .select('id, order_id, shipped_at, delivered_at, carrier, tracking_reference, created_at, orders(order_number, contact_name, companies(name)), production_jobs(job_number, product_name, serial_number)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (view === 'underveis') query = query.is('delivered_at', null);
  if (view === 'levert') query = query.not('delivered_at', 'is', null);

  const { data: deliveries } = await query;

  return (
    <>
      <PageHeader title="Leveranser" description="Det som er sendt til kunder, og om det er kommet fram." />

      <Tabs current={href(view)} items={Object.entries(VIEWS).map(([key, label]) => ({ href: href(key), label }))} />

      <Card flush>
        {deliveries?.length ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Bestilling</th><th>Kunde</th><th>Innhold</th><th>Sendt</th><th>Levert</th>
                <th>Transportør</th><th>Sporing</th><th />
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => {
                const job = delivery.production_jobs;
                return (
                  <tr key={delivery.id}>
                    <Td label="Bestilling" className="pt-table-strong">
                      <Link href={`/admin/bestillinger/${delivery.order_id}`}>
                        {delivery.orders?.order_number ?? 'Åpne'}
                      </Link>
                    </Td>
                    <Td label="Kunde">{delivery.orders?.companies?.name ?? delivery.orders?.contact_name ?? '–'}</Td>
                    <Td label="Innhold">
                      {job ? (
                        <div>
                          {job.product_name}
                          <div className="pt-hint">
                            {job.job_number}{job.serial_number ? `, produksjonsnr. ${job.serial_number}` : ''}
                          </div>
                        </div>
                      ) : 'Uten produksjonsjobb'}
                    </Td>
                    <Td label="Sendt" className="pt-nowrap">{dato(delivery.shipped_at)}</Td>
                    <Td label="Levert">
                      {delivery.delivered_at ? dato(delivery.delivered_at) : <Badge tone="info">Underveis</Badge>}
                    </Td>
                    <Td label="Transportør">{delivery.carrier ?? '–'}</Td>
                    <Td label="Sporing">{delivery.tracking_reference ?? '–'}</Td>
                    <Td>
                      {!delivery.delivered_at && (
                        <ActionButton
                          action={markDelivered}
                          fields={{ delivery_id: delivery.id }}
                          label="Marker levert"
                          tone="green"
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={view === 'alle' ? 'Ingen leveranser ennå' : 'Ingen leveranser her'} />
        )}
      </Card>
    </>
  );
}
