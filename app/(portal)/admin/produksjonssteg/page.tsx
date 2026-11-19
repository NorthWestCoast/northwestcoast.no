import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Check, Hidden, Input, Textarea } from '@/components/admin/fields';
import { addStep, deleteStep, setStepActive, setStepForCabinet, updateStep } from './actions';
import { CabinetToggle } from './cabinet-toggle';

/**
 * Sjekklista produksjonen kvitterer ut for hver jobb. En leider får alle
 * aktive steg; et oppbevaringsskap bestilt alene får bare stegene som er
 * merket «Gjelder også skap».
 */
export default async function ProduksjonsstegPage() {
  const { supabase } = await requireStaff();

  const { data: steps } = await supabase
    .from('production_step_templates')
    .select('id, position, title, description, active, for_cabinet')
    .order('position')
    .order('created_at');

  const nextPosition = (steps ?? []).reduce((max, step) => Math.max(max, step.position), 0) + 1;
  const cabinetSteps = (steps ?? []).filter((step) => step.active && step.for_cabinet).length;

  return (
    <>
      <PageHeader
        title="Produksjonssteg"
        description="Stegene produksjonen kvitterer ut på hver jobb, i den rekkefølgen de står her. Leidere får alle stegene. Skap som bestilles alene får bare de som er krysset av for skap."
      />

      <Alert tone="info" title="Endringer gjelder bare nye jobber">
        Stegene kopieres til jobben når bestillingen bekreftes. Jobber som allerede er opprettet beholder stegene sine.
      </Alert>

      {Boolean(steps?.length) && cabinetSteps === 0 && (
        <Alert tone="warn" title="Ingen steg gjelder skap">
          Et skap som bestilles alene får da ingen sjekkliste, og jobben står som klar for forsendelse med en gang.
        </Alert>
      )}

      <Card title={`Steg (${steps?.length ?? 0})`} flush>
        {steps?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th className="pt-num">Rekkefølge</th><th>Tittel</th><th>Beskrivelse</th><th>Gjelder også skap</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr key={step.id}>
                  <Td label="Rekkefølge" className="pt-num">{step.position}</Td>
                  <Td label="Tittel" className="pt-table-strong">{step.title}</Td>
                  <Td label="Beskrivelse">{step.description ?? '–'}</Td>
                  <Td label="Gjelder også skap">
                    <CabinetToggle
                      // Ny nøkkel når verdien endres et annet sted (skjemaet under), så avkrysningen følger med.
                      key={`${step.id}-${step.for_cabinet}`}
                      action={setStepForCabinet}
                      stepId={step.id}
                      title={step.title}
                      checked={step.for_cabinet}
                    />
                  </Td>
                  <Td label="Status">
                    {step.active ? <Badge tone="ok">Aktiv</Badge> : <Badge>Ikke aktiv</Badge>}
                  </Td>
                  <Td>
                    <ActionButton
                      action={setStepActive}
                      fields={{ step_id: step.id, active: step.active ? 'false' : 'true' }}
                      label={step.active ? 'Deaktiver' : 'Aktiver'}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen steg ennå">Uten steg får nye jobber en tom sjekkliste.</Empty>
        )}

        <Disclosure summary="Nytt steg" open={!steps?.length}>
          <PortalForm action={addStep} submitLabel="Legg til steg">
            <div className="pt-form-row">
              <Input scope="new" name="title" label="Tittel" required minLength={2} maxLength={160} />
              <Input
                scope="new"
                name="position"
                label="Rekkefølge"
                type="number"
                min={1}
                max={999}
                required
                inputMode="numeric"
                defaultValue={nextPosition}
                hint="Lavest tall kommer først."
              />
            </div>
            <Textarea scope="new" name="description" label="Beskrivelse" rows={2} maxLength={500} />
            <Check name="for_cabinet" label="Gjelder også skap (tas med på jobber som bare er et oppbevaringsskap)" />
          </PortalForm>
        </Disclosure>
      </Card>

      {Boolean(steps?.length) && (
        <Card title="Endre eller slett steg" flush>
          {steps?.map((step) => (
            <Disclosure key={step.id} summary={`${step.position}. ${step.title}${step.active ? '' : ' (ikke aktiv)'}`}>
              <div className="pt-form">
                <PortalForm action={updateStep} submitLabel="Lagre steget" resetOnSuccess={false}>
                  <Hidden fields={{ step_id: step.id }} />
                  <div className="pt-form-row">
                    <Input scope={step.id} name="title" label="Tittel" required minLength={2} maxLength={160} defaultValue={step.title} />
                    <Input
                      scope={step.id}
                      name="position"
                      label="Rekkefølge"
                      type="number"
                      min={1}
                      max={999}
                      required
                      inputMode="numeric"
                      defaultValue={step.position}
                      hint="Lavest tall kommer først."
                    />
                  </div>
                  <Textarea scope={step.id} name="description" label="Beskrivelse" rows={2} maxLength={500} defaultValue={step.description ?? ''} />
                  <Check name="active" label="Aktiv (tas med på nye jobber)" defaultChecked={step.active} />
                  <Check name="for_cabinet" label="Gjelder også skap" defaultChecked={step.for_cabinet} />
                </PortalForm>
                <div>
                  <ActionButton
                    action={deleteStep}
                    fields={{ step_id: step.id }}
                    label="Slett steget"
                    tone="danger"
                    confirm={`Slette «${step.title}»? Jobber som allerede er opprettet påvirkes ikke.`}
                  />
                </div>
              </div>
            </Disclosure>
          ))}
        </Card>
      )}
    </>
  );
}
