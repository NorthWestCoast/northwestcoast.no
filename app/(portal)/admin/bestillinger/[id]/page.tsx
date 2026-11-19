import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, Disclosure, Empty, KV, PageHeader, Progress, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Hidden, Input, Select } from '@/components/admin/fields';
import { jobStatus, orderStatus } from '@/lib/portal/labels';
import { dato, datoTid, idag, nok } from '@/lib/format';
import { fmtLength } from '@/lib/pricing';
import {
  confirmOrder, linkOrderCompany, markDelivered, registerDelivery, setExpectedDelivery, setOrderStatus,
} from '../actions';

const SOURCES: Record<string, string> = {
  web: 'Nettsiden',
  portal: 'Min side',
  calculator: 'Kalkulatoren',
};

export default async function BestillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireStaff();

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, confirmed_at, contact_name, contact_email, contact_phone, vessel_name, imo, delivery_address, notes, source, total_nok, expected_delivery, company_id, companies(id, name)')
    .eq('id', id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: lines }, { data: jobs }, { data: deliveries }, { data: companies }, { data: cabinetProducts }] = await Promise.all([
    supabase
      .from('order_lines')
      .select('id, qty, with_cabinet, unit_price_nok, cabinet_price_nok, line_total_nok, on_request, custom_length_m, cabinet_product_id, products(name, product_number, kind, cabinet_product_id)')
      .eq('order_id', id),
    supabase
      .from('production_jobs')
      .select('id, job_number, kind, product_name, serial_number, status, due_date, ladder_id, production_job_steps(done_at)')
      .eq('order_id', id)
      .order('job_number'),
    supabase
      .from('deliveries')
      .select('id, job_id, shipped_at, delivered_at, carrier, tracking_reference, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
    // Skapet på en linje er lagret som en id uten relasjon; navnet slås opp her.
    supabase.from('products').select('id, name').eq('kind', 'cabinet'),
  ]);

  const status = orderStatus(order.status);
  const open = order.status === 'new' || order.status === 'quoted';
  const closed = order.status === 'delivered' || order.status === 'cancelled';
  const jobById = new Map((jobs ?? []).map((job) => [job.id, job]));
  const orderId = { order_id: order.id };

  const cabinetName = new Map((cabinetProducts ?? []).map((product) => [product.id, product.name]));
  const kindOf = (line: NonNullable<typeof lines>[number]) => line.products?.kind ?? 'ladder';

  // Hva bekreftelsen setter i gang: én jobb per leider og per skap bestilt alene.
  // Skap som følger en leider, hører til leiderens jobb.
  const count = (kind: string) =>
    (lines ?? []).reduce((sum, line) => sum + (kindOf(line) === kind ? line.qty : 0), 0);
  const ladderJobs = count('ladder');
  const cabinetJobs = count('cabinet');
  const withCabinet = (lines ?? []).some((line) => kindOf(line) === 'ladder' && line.with_cabinet);
  const requestLines = (lines ?? []).filter((line) => line.on_request).length;
  const customLines = (lines ?? []).filter((line) => line.custom_length_m !== null).length;

  return (
    <>
      <PageHeader
        title={`Bestilling ${order.order_number}`}
        crumbs={[{ href: '/admin/bestillinger', label: 'Bestillinger' }, { label: order.order_number }]}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        description={`Mottatt ${datoTid(order.created_at)} fra ${(SOURCES[order.source] ?? order.source).toLowerCase()}.`}
      />

      <Card title="Kunde og levering">
        <div className="pt-stack">
          <KV
            items={[
              { label: 'Kontakt', value: order.contact_name },
              { label: 'E-post', value: <a href={`mailto:${order.contact_email}`}>{order.contact_email}</a> },
              {
                label: 'Telefon',
                value: order.contact_phone ? <a href={`tel:${order.contact_phone.replace(/\s/g, '')}`}>{order.contact_phone}</a> : '–',
              },
              {
                label: 'Selskap',
                value: order.companies
                  ? <Link href={`/admin/selskap/${order.companies.id}`}>{order.companies.name}</Link>
                  : 'Ikke knyttet til selskap',
              },
              { label: 'Fartøy', value: order.vessel_name ?? '–' },
              { label: 'IMO', value: order.imo ?? '–' },
              { label: 'Leveringsadresse', value: order.delivery_address ?? '–' },
              { label: 'Kilde', value: SOURCES[order.source] ?? order.source },
              { label: 'Forventet levering', value: dato(order.expected_delivery) },
              { label: 'Bekreftet', value: order.confirmed_at ? datoTid(order.confirmed_at) : 'Ikke bekreftet' },
            ]}
          />
          {order.notes && (
            <div className="pt-bubble">
              <div className="pt-bubble-head"><strong>Kommentar fra kunden</strong></div>
              <p>{order.notes}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="pt-grid pt-grid-main">
        <div>
          <Card
            title="Varelinjer"
            flush
            footer={
              requestLines > 0
                ? `Sum eks. mva: ${nok(order.total_nok)}. ${requestLines === 1 ? '1 linje' : `${requestLines} linjer`} med pris på forespørsel er ikke med i summen.`
                : `Sum eks. mva: ${nok(order.total_nok)}`
            }
          >
            {lines?.length ? (
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Produkt</th><th className="pt-num">Antall</th><th>Skap</th>
                    <th className="pt-num">Enhetspris</th><th className="pt-num">Linjesum</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const kind = kindOf(line);
                    const custom = line.custom_length_m !== null;
                    // Eldre linjer har ikke skapet lagret; da gjelder produktets skap.
                    const cabinet = cabinetName.get(line.cabinet_product_id ?? line.products?.cabinet_product_id ?? '');
                    return (
                      <tr key={line.id}>
                        <Td label="Produkt" className="pt-table-strong">
                          <div>
                            {custom
                              ? `Argostep – ${fmtLength(Number(line.custom_length_m))} m (spesiallengde)`
                              : line.products?.name ?? 'Ukjent produkt'}
                            {/* Skapet heter det samme som produktnummeret sitt; ikke gjenta det. */}
                            {line.products && !line.products.name.includes(line.products.product_number) && (
                              <span className="pt-muted"> ({line.products.product_number})</span>
                            )}
                            {custom && (
                              <div className="pt-list-sub">
                                Ønsket lengde {fmtLength(Number(line.custom_length_m))} m. Antall trinn må avklares.
                              </div>
                            )}
                            {kind === 'cabinet' && <div className="pt-list-sub">Skap uten leider, egen produksjonsjobb</div>}
                          </div>
                        </Td>
                        <Td label="Antall" className="pt-num">{line.qty}</Td>
                        <Td label="Skap">
                          {kind !== 'ladder'
                            ? '–'
                            : !line.with_cabinet
                              ? 'Nei'
                              : [
                                  'Ja',
                                  cabinet,
                                  line.on_request ? 'pris på forespørsel' : `${nok(line.cabinet_price_nok)} per stk.`,
                                ].filter(Boolean).join(', ')}
                        </Td>
                        <Td label="Enhetspris" className="pt-num">
                          {line.on_request ? <Badge tone="warn">Pris på forespørsel</Badge> : nok(line.unit_price_nok)}
                        </Td>
                        <Td label="Linjesum" className="pt-num">
                          {line.on_request && line.line_total_nok === 0 ? '–' : nok(line.line_total_nok)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty title="Bestillingen har ingen linjer" />
            )}
          </Card>

          <Card
            title="Produksjon"
            description="Én jobb per leider og én per skap som er bestilt alene. Jobbene opprettes når bestillingen bekreftes."
            flush
          >
            {jobs?.length ? (
              <table className="pt-table">
                <thead>
                  <tr><th>Jobb</th><th>Produkt</th><th>Produksjonsnr.</th><th>Fremdrift</th><th>Status</th><th>Frist</th></tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const state = jobStatus(job.status);
                    const total = job.production_job_steps.length;
                    const done = job.production_job_steps.filter((step) => step.done_at).length;
                    return (
                      <tr key={job.id}>
                        <Td label="Jobb" className="pt-table-strong">
                          <Link href={`/produksjon/${job.id}`}>{job.job_number}</Link>
                        </Td>
                        <Td label="Produkt">
                          <span>
                            {job.product_name}
                            {job.kind === 'cabinet' && <> <Badge>Skap</Badge></>}
                          </span>
                        </Td>
                        <Td label="Produksjonsnr.">
                          {job.ladder_id && job.serial_number
                            ? <Link href={`/minside/leider/${job.ladder_id}`}>{job.serial_number}</Link>
                            : job.serial_number ?? (job.kind === 'cabinet' ? 'Ikke påkrevd' : 'Ikke registrert')}
                        </Td>
                        <Td label="Fremdrift">
                          <div>
                            <Progress done={done} total={total} />
                            <span className="pt-hint">{done} av {total} steg</span>
                          </div>
                        </Td>
                        <Td label="Status"><Badge tone={state.tone}>{state.label}</Badge></Td>
                        <Td label="Frist" className="pt-nowrap">{dato(job.due_date)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty title="Ingen produksjonsjobber">
                {open
                  ? 'Bekreft bestillingen for å legge leidere og skap i produksjon.'
                  : 'Bestillingen har verken leidere eller skap som skal produseres.'}
              </Empty>
            )}
          </Card>

          <Card title="Leveranser" flush>
            {deliveries?.length ? (
              <table className="pt-table">
                <thead>
                  <tr><th>Gjelder</th><th>Sendt</th><th>Levert</th><th>Transportør</th><th>Sporing</th><th /></tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => {
                    const job = delivery.job_id ? jobById.get(delivery.job_id) : undefined;
                    return (
                      <tr key={delivery.id}>
                        <Td label="Gjelder">
                          {job ? `${job.job_number}${job.serial_number ? `, ${job.serial_number}` : ''}` : 'Uten produksjonsjobb'}
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
              <Empty title="Ingen leveranser registrert" />
            )}

            {jobs?.length ? (
              <div className="pt-card-foot">
                Leveransen registreres når produksjon sender jobben.
              </div>
            ) : open ? (
              <div className="pt-card-foot">Bekreft bestillingen før leveransen registreres.</div>
            ) : order.status !== 'cancelled' ? (
              <Disclosure summary="Registrer leveranse">
                <PortalForm action={registerDelivery} submitLabel="Registrer leveranse">
                  <Hidden fields={orderId} />
                  <div className="pt-form-row pt-form-row-3">
                    <Input scope="delivery" name="shipped_at" label="Sendt dato" type="date" required defaultValue={idag()} />
                    <Input scope="delivery" name="carrier" label="Transportør" maxLength={120} placeholder="Bring" />
                    <Input scope="delivery" name="tracking_reference" label="Sporingsnummer" maxLength={120} />
                  </div>
                </PortalForm>
              </Disclosure>
            ) : null}
          </Card>
        </div>

        <div>
          {open && (
            <Card title="Bekreft bestillingen">
              {requestLines > 0 && (
                <Alert tone="warn" title="Pris på forespørsel">
                  {requestLines === 1 ? '1 linje har' : `${requestLines} linjer har`} ikke fast pris. Avtal prisen med kunden før du bekrefter.
                  {customLines > 0 && ' For spesiallengder må også antall trinn avklares.'}
                </Alert>
              )}
              <p className="pt-hint" style={{ marginBottom: '0.9rem' }}>
                {ladderJobs + cabinetJobs === 0
                  ? 'Bestillingen har verken leidere eller skap, så ingen produksjonsjobb blir opprettet.'
                  : `Bekreftelsen oppretter ${[
                      ladderJobs > 0 ? `${ladderJobs} ${ladderJobs === 1 ? 'jobb' : 'jobber'} for ${ladderJobs === 1 ? 'leider' : 'leidere'}` : '',
                      cabinetJobs > 0 ? `${cabinetJobs} ${cabinetJobs === 1 ? 'jobb' : 'jobber'} for skap bestilt alene` : '',
                    ].filter(Boolean).join(' og ')}.${withCabinet ? ' Skap som følger en leider, hører til leiderens jobb.' : ''}`}
              </p>
              <PortalForm
                action={confirmOrder}
                submitLabel={ladderJobs + cabinetJobs === 0 ? 'Bekreft bestillingen' : 'Bekreft og legg i produksjon'}
                tone="green"
              >
                <Hidden fields={orderId} />
                <Input
                  scope="confirm"
                  name="due_date"
                  label="Ferdigdato (valgfritt)"
                  type="date"
                  min={idag()}
                  defaultValue={order.expected_delivery ?? ''}
                  hint="Vises som frist på produksjonsjobbene og som forventet levering for kunden."
                />
              </PortalForm>
            </Card>
          )}

          <Card title="Handlinger" flush>
            <Disclosure summary="Knytt til selskap" open={!order.company_id && !closed}>
              <PortalForm action={linkOrderCompany} submitLabel="Knytt til selskap" resetOnSuccess={false}>
                <Hidden fields={orderId} />
                <Select
                  scope="link"
                  name="company_id"
                  label="Selskap"
                  required
                  defaultValue={order.company_id ?? ''}
                  hint="Selskapet ser bestillingen og leiderne fra den på Min side."
                >
                  <option value="" disabled>Velg selskap</option>
                  {companies?.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              </PortalForm>
            </Disclosure>

            {!closed && (
              <Disclosure summary="Endre forventet levering">
                <PortalForm action={setExpectedDelivery} submitLabel="Lagre dato" resetOnSuccess={false}>
                  <Hidden fields={orderId} />
                  <Input
                    scope="expected"
                    name="expected_delivery"
                    label="Forventet levering"
                    type="date"
                    defaultValue={order.expected_delivery ?? ''}
                    hint="Tom dato fjerner den."
                  />
                </PortalForm>
              </Disclosure>
            )}

            {!closed && (
              <Disclosure summary="Endre status">
                <div className="pt-form">
                  {order.status === 'new' && (
                    <div>
                      <ActionButton
                        action={setOrderStatus}
                        fields={{ ...orderId, status: 'quoted' }}
                        label="Sett til «Tilbud sendt»"
                        size="md"
                      />
                    </div>
                  )}
                  <div>
                    <ActionButton
                      action={setOrderStatus}
                      fields={{ ...orderId, status: 'cancelled' }}
                      label="Kanseller bestillingen"
                      tone="danger"
                      size="md"
                      confirm={`Kansellere bestilling ${order.order_number}?`}
                    />
                  </div>
                  {Boolean(jobs?.length) && (
                    <p className="pt-hint">
                      Produksjonsjobber som er opprettet kanselleres hver for seg under Produksjon.
                    </p>
                  )}
                </div>
              </Disclosure>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
