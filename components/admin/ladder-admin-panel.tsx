import { getPortalContext } from '@/lib/portal/context';
import { createServerSupabase } from '@/lib/supabase/server';
import { Card, Disclosure } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { LOG_KINDS, ladderStatus } from '@/lib/portal/labels';
import { idag } from '@/lib/format';
import { addLadderTask, setLadderStatus, setServiceInterval } from '@/app/(portal)/admin/leidere/actions';
import { Hidden, Input, Select, Textarea } from './fields';
import LadderPlacement from './ladder-placement';
import LadderServiceAdmin from './ladder-service-admin';
import MaintenanceReportForm from './maintenance-report-form';
import ServiceForm from './service-form';

const STATUSES = ['in_production', 'delivered', 'installed', 'retired'] as const;

/**
 * Admin-verktøy på leidersiden: registrer service, endre serviceintervall,
 * knytt til kunde, fartøy og prosjekt, sett status og legg til planlagt oppgave.
 *
 * Vises bare for administratorer. Hver action sjekker rollen på nytt, og RLS
 * gjør det samme i databasen, så komponenten kan trygt stå på en kundeside.
 */
export default async function LadderAdminPanel({ ladderId }: { ladderId: string }) {
  const ctx = await getPortalContext();
  if (ctx?.staffRole !== 'admin') return null;

  const supabase = await createServerSupabase();
  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, serial_number, status, service_interval_months')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return null;

  const id = { ladder_id: ladder.id };

  return (
    <Card
      id="administrasjon"
      title="Administrasjon"
      description="Bare synlig for administratorer i NorthWestCoast."
      flush
    >
      {/* Service: rapport, bilder og servicesertifikat i ett skjema. */}
      <Disclosure summary="Registrer service">
        <ServiceForm
          ladders={[{ id: ladder.id, label: ladder.serial_number, intervalMonths: ladder.service_interval_months }]}
          performedBy={ctx.displayName}
          today={idag()}
          scope="adm-service"
        />
      </Disclosure>

      {/* Det som er registrert: legg til bilder, utsted eller trekk tilbake sertifikat. */}
      <Disclosure summary="Utførte servicer">
        <LadderServiceAdmin supabase={supabase} ladderId={ladder.id} />
      </Disclosure>

      <Disclosure summary="Loggfør vedlikehold">
        <div className="pt-stack">
          <p className="pt-hint">
            Vedlikehold NorthWestCoast har utført, eller noe kunden har meldt inn. Kunden ser rapporten i
            historikken til leideren.
          </p>
          <MaintenanceReportForm
            ladderId={ladder.id}
            performedBy={ctx.displayName}
            today={idag()}
            scope="adm-log"
          />
        </div>
      </Disclosure>

      <Disclosure summary="Endre serviceintervall">
        <PortalForm action={setServiceInterval} submitLabel="Lagre intervall" resetOnSuccess={false}>
          <Hidden fields={id} />
          <Input
            scope="adm-interval"
            name="service_interval_months"
            label="Måneder mellom hver service"
            type="number"
            min={1}
            max={120}
            required
            inputMode="numeric"
            defaultValue={ladder.service_interval_months}
            hint="Brukes til å beregne neste frist når servicerapporten ikke oppgir en."
          />
        </PortalForm>
      </Disclosure>

      {/* Kunde, fartøy og prosjekt: egen komponent med egne oppslag. */}
      <LadderPlacement supabase={supabase} ladderId={ladder.id} />

      <Disclosure summary="Sett status">
        <PortalForm action={setLadderStatus} submitLabel="Lagre status" resetOnSuccess={false}>
          <Hidden fields={id} />
          <Select scope="adm-status" name="status" label="Status" defaultValue={ladder.status}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{ladderStatus(status).label}</option>
            ))}
          </Select>
        </PortalForm>
      </Disclosure>

      <Disclosure summary="Legg til planlagt oppgave">
        <PortalForm action={addLadderTask} submitLabel="Legg til oppgave">
          <Hidden fields={id} />
          <Input scope="adm-task" name="title" label="Oppgave" required minLength={2} maxLength={160} placeholder="Halvårlig egenkontroll" />
          <div className="pt-form-row pt-form-row-3">
            <Select scope="adm-task" name="kind" label="Type" defaultValue="inspection">
              {Object.entries(LOG_KINDS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input scope="adm-task" name="due_date" label="Frist" type="date" required />
            <Input
              scope="adm-task"
              name="recurrence_months"
              label="Gjentas hver (måneder)"
              type="number"
              min={1}
              max={120}
              inputMode="numeric"
              hint="Tom: engangsoppgave."
            />
          </div>
          <Textarea scope="adm-task" name="description" label="Beskrivelse" rows={3} maxLength={1000} />
        </PortalForm>
      </Disclosure>
    </Card>
  );
}
