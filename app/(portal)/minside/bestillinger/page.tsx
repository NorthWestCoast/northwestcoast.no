import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/portal/context';
import { Badge, Card, Empty, KV, PageHeader, Progress, Td } from '@/components/portal/ui';
import { jobStatus, orderStatus } from '@/lib/portal/labels';
import { dato, nok } from '@/lib/format';

export const metadata: Metadata = { title: 'Mine bestillinger' };

/**
 * Bestillingene brukeren ser (egne, selskapets og de som er lagt inn med
 * samme e-post på nettsiden), med produksjon og levering per bestilling.
 */
export default async function BestillingerPage() {
  const { supabase } = await requireUser('/minside/bestillinger');

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, created_at, status, total_nok, expected_delivery, vessel_name, order_lines(id, qty, with_cabinet, on_request, line_total_nok, products(name, product_number)), production_jobs(id, job_number, status, product_name, serial_number, ladder_id, production_job_steps(done_at)), deliveries(id, shipped_at, delivered_at, carrier, tracking_reference)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader
        title="Mine bestillinger"
        description="Følg bestillingen fra den er mottatt til leideren er levert."
        actions={<Link href="/minside/bestill" className="pt-btn">Ny bestilling</Link>}
      />

      {orders && orders.length > 0 ? (
        orders.map((order) => {
          const status = orderStatus(order.status);
          const onRequest = order.order_lines.some((line) => line.on_request);
          return (
            <Card
              key={order.id}
              title={`Bestilling ${order.order_number}`}
              actions={<Badge tone={status.tone}>{status.label}</Badge>}
              flush
            >
              <div style={{ padding: '1.1rem' }}>
                <KV
                  items={[
                    { label: 'Bestilt', value: dato(order.created_at) },
                    { label: 'Sum eks. mva.', value: `${nok(order.total_nok)}${onRequest ? ' + tilbud' : ''}` },
                    { label: 'Forventet levering', value: order.expected_delivery ? dato(order.expected_delivery) : 'Ikke fastsatt' },
                    { label: 'Fartøy', value: order.vessel_name },
                  ]}
                />
              </div>

              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>Antall</th>
                    <th>Oppbevaringsskap</th>
                    <th className="pt-num">Linjesum</th>
                  </tr>
                </thead>
                <tbody>
                  {order.order_lines.map((line) => (
                    <tr key={line.id}>
                      <Td label="Produkt" className="pt-table-strong">
                        {line.products ? `${line.products.name} (${line.products.product_number})` : 'Produkt som er tatt ut av katalogen'}
                      </Td>
                      <Td label="Antall">{line.qty}</Td>
                      <Td label="Skap">{line.with_cabinet ? 'Med skap' : 'Uten skap'}</Td>
                      <Td label="Linjesum" className="pt-num">
                        {line.on_request ? 'Pris på forespørsel' : nok(line.line_total_nok)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {order.production_jobs.length > 0 && (
                <ul className="pt-list" style={{ borderTop: '1px solid var(--pt-line)' }}>
                  {order.production_jobs.map((job) => {
                    const done = job.production_job_steps.filter((step) => step.done_at).length;
                    const total = job.production_job_steps.length;
                    const state = jobStatus(job.status);
                    return (
                      <li key={job.id}>
                        <div className="pt-list-main">
                          <strong>Produksjon: {job.product_name}</strong>
                          <div className="pt-list-sub">
                            {job.job_number}
                            {' · '}
                            {job.serial_number ? (
                              job.ladder_id
                                ? <>produksjonsnr. <Link href={`/minside/leider/${job.ladder_id}`}>{job.serial_number}</Link></>
                                : `produksjonsnr. ${job.serial_number}`
                            ) : 'produksjonsnummer ikke tildelt ennå'}
                            {total > 0 ? ` · ${done} av ${total} steg` : ''}
                          </div>
                          {total > 0 && <div style={{ marginTop: '0.4rem' }}><Progress done={done} total={total} /></div>}
                        </div>
                        <div className="pt-list-side"><Badge tone={state.tone}>{state.label}</Badge></div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {order.deliveries.length > 0 && (
                <ul className="pt-list" style={{ borderTop: '1px solid var(--pt-line)' }}>
                  {order.deliveries.map((delivery) => (
                    <li key={delivery.id}>
                      <div className="pt-list-main">
                        <strong>
                          {delivery.delivered_at
                            ? `Levert ${dato(delivery.delivered_at)}`
                            : delivery.shipped_at ? `Sendt ${dato(delivery.shipped_at)}` : 'Forsendelse'}
                        </strong>
                        <div className="pt-list-sub">
                          {[
                            delivery.delivered_at && delivery.shipped_at ? `sendt ${dato(delivery.shipped_at)}` : null,
                            delivery.carrier ? `transportør ${delivery.carrier}` : null,
                            delivery.tracking_reference ? `sporingsnr. ${delivery.tracking_reference}` : null,
                          ].filter(Boolean).join(' · ') || 'Ingen sporingsopplysninger'}
                        </div>
                      </div>
                      <div className="pt-list-side">
                        <Badge tone={delivery.delivered_at ? 'ok' : 'info'}>{delivery.delivered_at ? 'Levert' : 'Sendt'}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Empty title="Ingen bestillinger ennå" action={{ href: '/minside/bestill', label: 'Bestill leider og deler' }}>
            Bestillinger du legger inn her eller på nettsiden med samme e-postadresse, vises på denne siden.
          </Empty>
        </Card>
      )}
    </>
  );
}
