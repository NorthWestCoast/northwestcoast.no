import { getPortalContext } from '@/lib/portal/context';
import { createServerSupabase } from '@/lib/supabase/server';
import { Card, Disclosure } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { LOG_KINDS, ladderStatus } from '@/lib/portal/labels';
import { assignLadder, recordService } from '@/app/(portal)/admin/actions';
import { addLadderTask, setLadderStatus, setServiceInterval } from '@/app/(portal)/admin/leidere/actions';
import { Hidden, Input, Select, Textarea } from './fields';
import ServiceFields from './service-fields';

const STATUSES = ['in_production', 'delivered', 'installed', 'retired'] as const;

/**
 * Admin-verktøy på leidersiden: registrer service, endre serviceintervall,
 * flytt til selskap/fartøy, sett status og legg til planlagt oppgave.
 *
 * Vises bare for administratorer. Hver action sjekker rollen på nytt, og RLS
 * gjør det samme i databasen, så komponenten kan trygt stå på en kundeside.
 */
export default async function LadderAdminPanel({ ladderId }: { ladderId: string }) {
  const ctx = await getPortalContext();
  if (ctx?.staffRole !== 'admin') return null;

  const supabase = await createServerSupabase();
  const [{ data: ladder }, { data: companies }, { data: vessels }] = await Promise.all([
    supabase
      .from('ladders')
      .select('id, serial_number, status, service_interval_months, company_id, vessel_id, installed_at')
      .eq('id', ladderId)
      .maybeSingle(),
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('vessels').select('id, name, companies(name)').order('name'),
  ]);
  if (!ladder) return null;

  const id = { ladder_id: ladder.id };

  return (
    <Card
      id="administrasjon"
      title="Administrasjon"
      description="Bare synlig for administratorer i NorthWest Coast."
      flush
    >
      <Disclosure summary="Registrer service">
        <PortalForm action={recordService} submitLabel="Lagre servicerapport">
          <Hidden fields={id} />
          <ServiceFields scope="adm-service" performedBy={ctx.displayName} />
        </PortalForm>
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

      <Disclosure summary="Flytt til selskap eller fartøy">
        <PortalForm action={assignLadder} submitLabel="Flytt leideren" resetOnSuccess={false}>
          <Hidden fields={id} />
          <div className="pt-form-row">
            <Select scope="adm-move" name="company_id" label="Selskap" defaultValue={ladder.company_id ?? ''}>
              <option value="">Ikke valgt</option>
              {companies?.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </Select>
            <Select scope="adm-move" name="vessel_id" label="Fartøy" defaultValue={ladder.vessel_id ?? ''}>
              <option value="">Ikke valgt</option>
              {vessels?.map((vessel) => (
                <option key={vessel.id} value={vessel.id}>
                  {vessel.name}{vessel.companies ? ` (${vessel.companies.name})` : ''}
                </option>
              ))}
            </Select>
          </div>
          <Input
            scope="adm-move"
            name="installed_at"
            label="Montert dato"
            type="date"
            defaultValue={ladder.installed_at ?? ''}
            hint="Gjelder når et fartøy er valgt. Med dato regnes leideren som i bruk, og servicefristen løper fra datoen. Uten dato er den levert, men ikke montert."
          />
        </PortalForm>
      </Disclosure>

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
