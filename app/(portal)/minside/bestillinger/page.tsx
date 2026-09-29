import { createServerSupabase } from '@/lib/supabase/server';
import { dato, nok } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  new: 'Mottatt',
  quoted: 'Tilbud sendt',
  confirmed: 'Bekreftet',
  in_production: 'I produksjon',
  delivered: 'Levert',
  cancelled: 'Kansellert',
};

export default async function BestillingerPage() {
  const supabase = await createServerSupabase();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_nok, vessel_name, notes, created_at')
    .order('created_at', { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.id);

  const [{ data: lines }, { data: deliveries }] = await Promise.all([
    orderIds.length
      ? supabase
          .from('order_lines')
          .select('id, order_id, qty, with_cabinet, line_total_nok, product_id')
          .in('order_id', orderIds)
      : Promise.resolve({ data: [] as never[] }),
    orderIds.length
      ? supabase
          .from('deliveries')
          .select('id, order_id, shipped_at, delivered_at, carrier, tracking_reference')
          .in('order_id', orderIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const { data: products } = await supabase.from('products').select('id, name, product_number');
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return (
    <>
      <h1>Bestillinger</h1>

      {orders?.length ? (
        <div className="ms-orders">
          {orders.map((order) => {
            const own = (lines ?? []).filter((l) => l.order_id === order.id);
            const delivery = (deliveries ?? []).find((d) => d.order_id === order.id);

            return (
              <article key={order.id} className="ms-section">
                <div className="ms-title-row">
                  <h2>{order.order_number}</h2>
                  <span className="ms-badge ms-badge-neutral">
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>

                <dl className="ms-kv ms-kv-wide">
                  <div><dt>Mottatt</dt><dd>{dato(order.created_at)}</dd></div>
                  <div><dt>Fartøy</dt><dd>{order.vessel_name ?? '–'}</dd></div>
                  <div><dt>Sum</dt><dd>{nok(order.total_nok)} eks. mva.</dd></div>
                </dl>

                {own.length > 0 && (
                  <table className="ms-table">
                    <thead><tr><th>Produkt</th><th>Antall</th><th>Skap</th><th>Sum</th></tr></thead>
                    <tbody>
                      {own.map((line) => (
                        <tr key={line.id}>
                          <td>{productById.get(line.product_id)?.name ?? '–'}</td>
                          <td>{line.qty}</td>
                          <td>{line.with_cabinet ? 'Ja' : 'Nei'}</td>
                          <td>{nok(line.line_total_nok)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {delivery && (
                  <p className="ms-delivery">
                    {delivery.delivered_at
                      ? `Levert ${dato(delivery.delivered_at)}`
                      : delivery.shipped_at
                        ? `Sendt ${dato(delivery.shipped_at)}`
                        : 'Under klargjøring'}
                    {delivery.carrier ? ` · ${delivery.carrier}` : ''}
                    {delivery.tracking_reference ? ` · ${delivery.tracking_reference}` : ''}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="ms-muted">
          Ingen bestillinger registrert på selskapet. Bestillinger gjort før
          Min side ble tatt i bruk vises ikke her.
        </p>
      )}
    </>
  );
}
