import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Badge, Card, Disclosure, Empty, KV, PageHeader, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Hidden, Input, Select, Textarea } from '@/components/admin/fields';
import ServiceFields from '@/components/admin/service-fields';
import { agreementStatus } from '@/components/admin/agreement-fields';
import { bookingStatus, serviceResult, serviceState } from '@/lib/portal/labels';
import { dato, fristTekst, idag, nok } from '@/lib/format';
import { recordService } from '../actions';
import { cancelBooking, scheduleBooking } from './actions';

/**
 * Service: bestillinger fra kundene, leidere der fristen nærmer seg,
 * registrering av utført service, og serviceavtalene.
 */
export default async function ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ leider?: string }>;
}) {
  const preselected = uuid((await searchParams).leider ?? null);
  const { supabase, ctx } = await requireStaff();

  const [{ data: bookings }, { data: due }, { data: ladders }, { data: agreements }, { data: reports }] =
    await Promise.all([
      supabase
        .from('service_bookings')
        .select('id, status, created_at, preferred_date, location, notes, requester_name, scheduled_date, technician, staff_note, ladder_id, ladders(serial_number, companies(id, name), vessels(name))')
        .in('status', ['requested', 'scheduled'])
        .order('created_at', { ascending: true }),
      supabase
        .from('ladder_status')
        .select('ladder_id, serial_number, company_name, vessel_name, next_service_due, days_until_service, service_state, booked_service_date')
        .in('service_state', ['overdue', 'due_soon'])
        .neq('status', 'retired')
        .order('next_service_due', { ascending: true })
        .limit(200),
      supabase
        .from('ladder_status')
        .select('ladder_id, serial_number, company_name, vessel_name')
        .order('serial_number')
        .limit(1000),
      supabase
        .from('service_agreements')
        .select('id, title, status, starts_on, ends_on, interval_months, price_nok, company_id, companies(name)')
        .order('starts_on', { ascending: false })
        .limit(200),
      supabase
        .from('service_reports')
        .select('id, performed_at, performed_by, result, next_service_due, ladder_id, ladders(serial_number)')
        .order('performed_at', { ascending: false })
        .limit(15),
    ]);

  const requested = (bookings ?? []).filter((booking) => booking.status === 'requested');
  const scheduled = (bookings ?? [])
    .filter((booking) => booking.status === 'scheduled')
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));

  return (
    <>
      <PageHeader
        title="Service og avtaler"
        description="Servicebestillinger fra kundene, frister som nærmer seg og serviceavtaler."
      />

      {[...requested, ...scheduled].map((booking) => {
        const status = bookingStatus(booking.status);
        const isRequested = booking.status === 'requested';
        const bookingId = { booking_id: booking.id };
        return (
          <Card
            key={booking.id}
            title={
              <>
                Service på leider{' '}
                <Link href={`/minside/leider/${booking.ladder_id}`} className="pt-link">
                  {booking.ladders?.serial_number ?? 'uten nummer'}
                </Link>
              </>
            }
            actions={<Badge tone={status.tone}>{isRequested ? 'Venter på avtale' : `Avtalt ${dato(booking.scheduled_date)}`}</Badge>}
            flush
          >
            <div className="pt-card-body pt-stack">
              <KV
                items={[
                  {
                    label: 'Kunde',
                    value: booking.ladders?.companies
                      ? <Link href={`/admin/selskap/${booking.ladders.companies.id}`}>{booking.ladders.companies.name}</Link>
                      : '–',
                  },
                  { label: 'Fartøy', value: booking.ladders?.vessels?.name ?? '–' },
                  { label: 'Bestilt av', value: `${booking.requester_name ?? 'Ukjent'}, ${dato(booking.created_at)}` },
                  { label: 'Ønsket dato', value: dato(booking.preferred_date) },
                  { label: 'Sted', value: booking.location ?? '–' },
                  ...(isRequested ? [] : [{ label: 'Tekniker', value: booking.technician ?? '–' }]),
                ]}
              />
              {booking.notes && (
                <div className="pt-bubble">
                  <div className="pt-bubble-head"><strong>Fra kunden</strong></div>
                  <p>{booking.notes}</p>
                </div>
              )}
            </div>

            <Disclosure summary={isRequested ? 'Avtal service' : 'Endre avtalen'} open={isRequested}>
              <PortalForm action={scheduleBooking} submitLabel={isRequested ? 'Avtal service' : 'Lagre avtalen'} tone="green" resetOnSuccess={false}>
                <Hidden fields={bookingId} />
                <div className="pt-form-row">
                  <Input
                    scope={`plan-${booking.id}`}
                    name="scheduled_date"
                    label="Dato"
                    type="date"
                    required
                    min={idag()}
                    defaultValue={booking.scheduled_date ?? booking.preferred_date ?? ''}
                  />
                  <Input
                    scope={`plan-${booking.id}`}
                    name="technician"
                    label="Tekniker"
                    maxLength={120}
                    defaultValue={booking.technician ?? ''}
                  />
                </div>
                <Textarea
                  scope={`plan-${booking.id}`}
                  name="staff_note"
                  label="Melding til kunden"
                  rows={2}
                  maxLength={1000}
                  defaultValue={booking.staff_note ?? ''}
                />
              </PortalForm>
            </Disclosure>

            <Disclosure summary="Avlys bestillingen">
              <PortalForm action={cancelBooking} submitLabel="Avlys bestillingen" resetOnSuccess={false}>
                <Hidden fields={bookingId} />
                <Textarea
                  scope={`cancel-${booking.id}`}
                  name="staff_note"
                  label="Begrunnelse til kunden"
                  rows={2}
                  maxLength={1000}
                />
              </PortalForm>
            </Disclosure>
          </Card>
        );
      })}

      {!bookings?.length && (
        <Card title="Servicebestillinger">
          <Empty title="Ingen servicebestillinger venter" />
        </Card>
      )}

      <Card
        id="forfaller"
        title="Service forfaller"
        description="Leidere der fristen er passert eller kommer innen 30 dager."
        flush
      >
        {due?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Leider</th><th>Kunde</th><th>Fartøy</th><th>Frist</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {due.map((row) => {
                const state = serviceState(row.service_state);
                return (
                  <tr key={row.ladder_id}>
                    <Td label="Leider" className="pt-table-strong">
                      <Link href={`/minside/leider/${row.ladder_id}`}>{row.serial_number}</Link>
                    </Td>
                    <Td label="Kunde">{row.company_name ?? '–'}</Td>
                    <Td label="Fartøy">{row.vessel_name ?? '–'}</Td>
                    <Td label="Frist">{dato(row.next_service_due)} ({fristTekst(row.days_until_service)})</Td>
                    <Td label="Status">
                      {row.booked_service_date
                        ? <Badge tone="ok">Avtalt {dato(row.booked_service_date)}</Badge>
                        : <Badge tone={state.tone}>{state.label}</Badge>}
                    </Td>
                    <Td>
                      <Link href={`/admin/service?leider=${row.ladder_id}#registrer`} className="pt-btn pt-btn-ghost pt-btn-sm">
                        Registrer service
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen leidere med forfalt eller nær forestående service" />
        )}
      </Card>

      <Card
        id="registrer"
        title="Registrer utført service"
        description="Fagmessig kontroll utført av NorthWest Coast. Rapporten avslutter åpne servicebestillinger på leideren og setter ny frist."
      >
        <PortalForm action={recordService} submitLabel="Lagre servicerapport">
          <Select name="ladder_id" label="Leider" required defaultValue={preselected ?? ''}>
            <option value="" disabled>Velg leider</option>
            {ladders?.map((ladder) => (
              <option key={ladder.ladder_id} value={ladder.ladder_id ?? ''}>
                {ladder.serial_number}
                {ladder.company_name ? ` · ${ladder.company_name}` : ''}
                {ladder.vessel_name ? ` · ${ladder.vessel_name}` : ''}
              </option>
            ))}
          </Select>
          <ServiceFields scope="service" performedBy={ctx.displayName} />
        </PortalForm>
      </Card>

      <Card
        title="Serviceavtaler"
        description="Avtalene opprettes og endres på selskapets side."
        flush
      >
        {agreements?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Selskap</th><th>Avtale</th><th>Periode</th><th>Intervall</th><th className="pt-num">Pris</th><th>Status</th></tr>
            </thead>
            <tbody>
              {agreements.map((agreement) => {
                const status = agreementStatus(agreement.status);
                return (
                  <tr key={agreement.id}>
                    <Td label="Selskap" className="pt-table-strong">
                      <Link href={`/admin/selskap/${agreement.company_id}`}>{agreement.companies?.name ?? 'Åpne selskapet'}</Link>
                    </Td>
                    <Td label="Avtale">{agreement.title}</Td>
                    <Td label="Periode">
                      {dato(agreement.starts_on)} – {agreement.ends_on ? dato(agreement.ends_on) : 'løpende'}
                    </Td>
                    <Td label="Intervall">Hver {agreement.interval_months}. måned</Td>
                    <Td label="Pris" className="pt-num">{agreement.price_nok === null ? '–' : nok(agreement.price_nok)}</Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen serviceavtaler ennå">Opprett en avtale på selskapets side.</Empty>
        )}
      </Card>

      <Card title="Siste servicerapporter" flush>
        {reports?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Leider</th><th>Utført</th><th>Utført av</th><th>Resultat</th><th>Neste frist</th></tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const result = serviceResult(report.result);
                return (
                  <tr key={report.id}>
                    <Td label="Leider" className="pt-table-strong">
                      <Link href={`/minside/leider/${report.ladder_id}`}>{report.ladders?.serial_number ?? 'Åpne'}</Link>
                    </Td>
                    <Td label="Utført" className="pt-nowrap">{dato(report.performed_at)}</Td>
                    <Td label="Utført av">{report.performed_by}</Td>
                    <Td label="Resultat"><Badge tone={result.tone}>{result.label}</Badge></Td>
                    <Td label="Neste frist" className="pt-nowrap">{dato(report.next_service_due)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen servicerapporter registrert" />
        )}
      </Card>
    </>
  );
}
