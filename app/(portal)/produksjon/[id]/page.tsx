import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProduction } from '@/lib/portal/context';
import { uuid } from '@/lib/portal/forms';
import { jobStatus } from '@/lib/portal/labels';
import { Alert, Badge, Card, KV, PageHeader, Progress } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { JobKindBadge, datoOslo, isCabinetJob, isCustomJob, isOverdue, meter, specLine } from '@/components/produksjon/job';
import { JobParts } from '@/components/produksjon/parts';
import { StepSignoff } from '@/components/produksjon/step-signoff';
import { dato, datoTid, idag } from '@/lib/format';
import {
  assignSerial,
  cancelJob,
  deliverJob,
  fulfilFromStock,
  setStep,
  shipJob,
  stockJob,
  updateJob,
} from '../actions';

/** «Marker som levert», med forklaring når jobben leveres uten å være sendt. */
function DeliverButton({ jobId, thing, shipped }: { jobId: string; thing: string; shipped: boolean }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <ActionButton
        action={deliverJob}
        fields={{ job: jobId }}
        label="Marker som levert"
        pendingLabel="Lagrer…"
        tone={shipped ? 'green' : 'ghost'}
        size="md"
        confirm="Marker jobben som levert til kunden? Dette kan ikke angres."
      />
      {!shipped && (
        <p className="pt-hint" style={{ marginTop: '0.4rem' }}>
          Bruk denne når kunden henter {thing} selv, uten forsendelse.
        </p>
      )}
    </div>
  );
}

/** Sending og levering. Sammenslått når jobben er bygget for lager og sjelden skal sendes direkte. */
function SendOptions({ fold, children }: { fold: boolean; children: React.ReactNode }) {
  if (!fold) return <>{children}</>;
  return (
    <details className="pt-more">
      <summary>Send eller lever uten å legge på lager</summary>
      {children}
    </details>
  );
}

/**
 * Én produksjonsjobb: spesifikasjonen, delene den bruker, stegene som
 * kvitteres ut, produksjonsnummeret og forsendelsen.
 *
 * En jobb uten bestilling kan legges på lager når den er ferdig. En jobb med
 * bestilling kan i stedet for å bygges, leveres med en enhet som alt står på
 * lager («Hent fra lager»).
 *
 * En jobb er enten en leider eller et oppbevaringsskap bestilt alene. Skapet
 * har verken lengde eller trinn, og kan sendes uten produksjonsnummer.
 *
 * Alt leses fra production_jobs og production_job_steps. Bestillingen og
 * kunden slås ikke opp; det produksjon trenger ble kopiert til jobben da den
 * ble opprettet.
 */
export default async function JobbPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = uuid(raw);
  if (!id) notFound();

  const { supabase, ctx } = await requireProduction(`/produksjon/${id}`);
  const isAdmin = ctx.staffRole === 'admin';

  const [{ data: job }, { data: stepRows }] = await Promise.all([
    supabase.from('production_jobs').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('production_job_steps')
      .select('id, position, title, description, done_at, done_by_name, note')
      .eq('job_id', id)
      .order('position', { ascending: true }),
  ]);
  if (!job) notFound();

  const steps = stepRows ?? [];
  const done = steps.filter((step) => step.done_at !== null).length;
  const status = jobStatus(job.status);

  /** Ferdig levert eller kansellert: ingenting kan endres lenger. */
  const closed = job.status === 'delivered' || job.status === 'cancelled';
  /** Ferdig bygget uten bestilling og lagt på lager som ferdigvare. */
  const stocked = job.status === 'stocked';
  /** Stegene låses når jobben har forlatt produksjonen. */
  const stepsLocked = closed || stocked || job.status === 'shipped';
  const overdue = isOverdue(job, idag());
  /** Bygget uten bestilling: kan legges på lager når den er ferdig. */
  const forStock = job.order_id === null;

  const cabinetJob = isCabinetJob(job);
  const customJob = isCustomJob(job);
  /** «leideren» eller «skapet», til setninger om det som produseres. */
  const thing = cabinetJob ? 'skapet' : 'leideren';
  /** Skap kan sendes uten nummer; en leider må ha det. */
  const serialMissing = !cabinetJob && !job.serial_number;

  // Ferdige enheter på lager av samme produkt og lengde, eldste først. De kan
  // ta plassen til denne jobben så lenge den ikke har fått et eget
  // produksjonsnummer; da er det ingenting å miste ved å bytte.
  const canFulfil = !forStock
    && (job.status === 'queued' || job.status === 'in_progress')
    && !job.serial_number
    && !job.ladder_id;
  const { data: stockRows } = canFulfil
    ? await supabase
        .from('production_jobs')
        .select('id, job_number, serial_number, length_m, completed_at')
        .eq('status', 'stocked')
        .eq('product_id', job.product_id)
        .order('completed_at', { ascending: true, nullsFirst: false })
        .limit(200)
    : { data: null };
  const sameLength = (value: number | null) =>
    value === null || job.length_m === null ? value === job.length_m : Number(value) === Number(job.length_m);
  const onShelf = (stockRows ?? []).filter((row) => sameLength(row.length_m));

  // Transportør og sporing ligger på leveransen, som hører til bestillingen.
  // Den er bare lesbar for administratorer.
  const { data: delivery } = isAdmin && (job.status === 'shipped' || job.status === 'delivered')
    ? await supabase
        .from('deliveries')
        .select('carrier, tracking_reference')
        .eq('job_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <PageHeader
        title={`Jobb ${job.job_number}`}
        description={cabinetJob ? `${job.product_name} · bestilt uten leider` : `${job.product_name} · ${specLine(job)}`}
        crumbs={[{ href: '/produksjon', label: 'Tavle' }, { label: job.job_number }]}
        badge={<><Badge tone={status.tone}>{status.label}</Badge> <JobKindBadge job={job} /></>}
        actions={
          isAdmin && job.order_id && (
            <Link href={`/admin/bestillinger/${job.order_id}`} className="pt-btn pt-btn-ghost">
              Åpne bestillingen
            </Link>
          )
        }
      />

      {overdue && (
        <Alert tone="danger" title={`Fristen var ${dato(job.due_date)}`}>
          Jobben er ikke sendt ennå.
        </Alert>
      )}

      {customJob && !closed && (
        <Alert tone="warn" title={`Spesiallengde: ${meter(job.length_m)}`}>
          Leideren lages i lengden kunden har bedt om, ikke i en standardlengde.
          {job.steps
            ? ` Antall trinn er satt til ${job.steps}.`
            : ' Antall trinn er ikke fastsatt. Avklar det med en administrator før du starter.'}
        </Alert>
      )}

      <Card title="Spesifikasjon">
        <KV
          items={[
            { label: 'Jobbnummer', value: <span className="pt-mono">{job.job_number}</span> },
            { label: 'Ordrenummer', value: job.order_number ?? 'Ingen (manuell jobb)' },
            { label: 'Kunde', value: job.customer_label ?? '–' },
            { label: 'Fartøy', value: job.vessel_name ?? '–' },
            { label: 'Produkt', value: job.product_name },
            { label: 'Produktnummer', value: <span className="pt-mono">{job.product_number}</span> },
            // Et skap bestilt alene har verken lengde, trinn eller tilhørende skap.
            ...(cabinetJob
              ? [{ label: 'Type', value: 'Oppbevaringsskap uten leider' }]
              : [
                  {
                    label: customJob ? 'Ønsket lengde' : 'Lengde',
                    value: customJob ? <strong>{meter(job.length_m)} (spesiallengde)</strong> : meter(job.length_m),
                  },
                  { label: 'Antall trinn', value: job.steps ?? 'Må avklares' },
                  {
                    label: 'Oppbevaringsskap',
                    value: job.with_cabinet ? `Ja${job.cabinet_name ? `, ${job.cabinet_name}` : ''}` : 'Nei',
                  },
                ]),
            { label: 'Frist', value: job.due_date ? dato(job.due_date) : 'Ingen frist' },
            { label: 'Status', value: status.label },
            {
              label: 'Produksjonsnummer',
              value: job.serial_number
                ? <span className="pt-mono">{job.serial_number}</span>
                : cabinetJob ? 'Ikke registrert (valgfritt for skap)' : 'Ikke registrert',
            },
          ]}
        />
        {/* Egen rad i full bredde: kravene kan være lange og skal ikke overses. */}
        <dl className="pt-kv" style={{ gridTemplateColumns: '1fr', marginTop: '0.9rem' }}>
          <div>
            <dt>Spesielle krav</dt>
            <dd style={{ whiteSpace: 'pre-line' }}>{job.spec_notes ?? 'Ingen'}</dd>
          </div>
        </dl>
      </Card>

      {onShelf.length > 0 && (
        <Card
          title="Hent fra lager"
          description={`${onShelf.length === 1 ? 'Det står 1 ferdig enhet' : `Det står ${onShelf.length} ferdige enheter`} av samme produkt og lengde på lager. Velger du en av dem, tar den plassen til denne jobben: produksjonsnummeret og historikken følger med, og delene trekkes ikke en gang til.`}
          flush
        >
          <ul className="pt-list">
            {onShelf.map((unit) => (
              <li key={unit.id}>
                <div className="pt-list-main">
                  <Link href={`/produksjon/${unit.id}`}>{unit.job_number}</Link>
                  <div className="pt-list-sub">
                    {unit.serial_number
                      ? <>Prod.nr. <span className="pt-mono">{unit.serial_number}</span></>
                      : 'Uten produksjonsnummer'}
                    {unit.completed_at && <> · ferdig {datoOslo(unit.completed_at)}</>}
                  </div>
                </div>
                <div className="pt-list-side">
                  <ActionButton
                    action={fulfilFromStock}
                    fields={{ job: job.id, stock_job: unit.id }}
                    label="Bruk denne"
                    pendingLabel="Henter…"
                    tone="green"
                    confirm={`Levere bestilling ${job.order_number ?? ''} med ${unit.serial_number ?? unit.job_number} fra lager? Jobb ${job.job_number} fjernes, og ${unit.job_number} blir bestillingens jobb.`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <JobParts supabase={supabase} job={job} isAdmin={isAdmin} />

      <div className="pt-grid pt-grid-main">
        <Card
          flush
          title="Steg"
          description={`${done} av ${steps.length} kvittert ut`}
          actions={<div style={{ width: '8rem' }}><Progress done={done} total={steps.length} /></div>}
        >
          {steps.length > 0 ? (
            <ol className="pt-steps">
              {steps.map((step) => (
                <li key={step.id} data-done={step.done_at ? 'true' : undefined}>
                  <div className="pt-step-title">{step.title}</div>
                  <div className="pt-step-meta">
                    {step.description && <div>{step.description}</div>}
                    {step.done_at && (
                      <div>
                        Kvittert ut av {step.done_by_name ?? 'ukjent'}, {datoTid(step.done_at)}
                      </div>
                    )}
                    {step.note && <div style={{ whiteSpace: 'pre-line' }}>Notat: {step.note}</div>}
                  </div>
                  {!stepsLocked && (
                    <div className="pt-step-actions">
                      <StepSignoff action={setStep} stepId={step.id} done={step.done_at !== null} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="pt-hint" style={{ padding: '1.1rem' }}>
              {cabinetJob
                ? 'Jobben har ingen steg. Ingen av stegene i malen gjelder skap, så jobben er klar for forsendelse.'
                : 'Jobben har ingen steg. Stegene hentes fra malen når jobben opprettes.'}
            </p>
          )}
        </Card>

        <div className="pt-stack">
          <Card
            title={cabinetJob ? 'Produksjonsnummer (valgfritt)' : 'Produksjonsnummer'}
            description={
              cabinetJob
                ? 'Har skapet et eget nummer, registrerer du det her. Skapet kan sendes og leveres uten.'
                : 'Nummeret som merkes på leideren. Når det registreres, opprettes leideren i registeret.'
            }
          >
            {closed ? (
              <p className="pt-mono">{job.serial_number ?? 'Ikke registrert'}</p>
            ) : (
              <PortalForm
                action={assignSerial}
                submitLabel={job.serial_number ? 'Rett nummeret' : 'Registrer'}
                resetOnSuccess={false}
              >
                <input type="hidden" name="job" value={job.id} />
                <div className="pt-field">
                  <label htmlFor="job-serial">Produksjonsnummer</label>
                  <input
                    id="job-serial"
                    name="serial"
                    defaultValue={job.serial_number ?? ''}
                    minLength={3}
                    maxLength={40}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                  />
                  <small>
                    3–40 tegn: bokstaver, tall og bindestrek. Kan rettes helt til jobben er levert.
                  </small>
                </div>
              </PortalForm>
            )}
          </Card>

          <Card title={forStock ? 'Lager og forsendelse' : 'Forsendelse'}>
            {(job.status === 'queued' || job.status === 'in_progress') && (
              <p className="pt-hint">
                {forStock
                  ? `Jobben har ingen bestilling. Når alle steg er kvittert ut${cabinetJob ? '' : ' og produksjonsnummeret er registrert'}, kan ${thing} legges på lager.`
                  : cabinetJob
                    ? 'Jobben kan sendes når alle steg er kvittert ut. Skap trenger ikke produksjonsnummer.'
                    : 'Jobben kan sendes når alle steg er kvittert ut og produksjonsnummeret er registrert.'}
              </p>
            )}

            {job.status === 'ready' && serialMissing && (
              <Alert tone="warn" title="Produksjonsnummeret mangler">
                {forStock
                  ? 'Registrer det før leideren legges på lager, sendes eller leveres.'
                  : 'Registrer det før jobben sendes eller leveres.'}
              </Alert>
            )}

            {job.status === 'ready' && forStock && (
              <div style={{ marginBottom: '1rem' }}>
                <ActionButton
                  action={stockJob}
                  fields={{ job: job.id }}
                  label="Legg på lager"
                  pendingLabel="Lagrer…"
                  tone="green"
                  size="md"
                />
                <p className="pt-hint" style={{ marginTop: '0.4rem' }}>
                  Jobben har ingen bestilling. På lager står {thing} som ferdigvare til den knyttes til en bestilling,
                  og jobben er avsluttet.
                </p>
              </div>
            )}

            {job.status === 'ready' && (
              /* Uten bestilling er det sjelden noe å sende: valgene ligger sammenslått under «Legg på lager». */
              <SendOptions fold={forStock}>
                <PortalForm action={shipJob} submitLabel="Marker som sendt" pendingLabel="Lagrer…" tone={forStock ? 'primary' : 'green'}>
                  <input type="hidden" name="job" value={job.id} />
                  <div className="pt-field">
                    <label htmlFor="job-carrier">Transportør</label>
                    <input id="job-carrier" name="carrier" maxLength={120} placeholder="F.eks. Bring" />
                  </div>
                  <div className="pt-field">
                    <label htmlFor="job-tracking">Sporingsnummer</label>
                    <input id="job-tracking" name="tracking" maxLength={120} autoComplete="off" />
                  </div>
                </PortalForm>
                <DeliverButton jobId={job.id} thing={thing} shipped={false} />
              </SendOptions>
            )}

            {stocked && (
              <>
                {/* Vanlig tekst, ikke nøkkel/verdi: kortet er for smalt til fire kolonner. */}
                <p>
                  {cabinetJob ? 'Skapet' : 'Leideren'} står på lager som ferdigvare
                  {job.completed_at ? `, ferdig ${datoTid(job.completed_at)}` : ''}.
                </p>
                <p className="pt-hint" style={{ marginTop: '0.6rem' }}>
                  Enheten leveres ved å knyttes til en bestilling: åpne jobben som bestillingen opprettet, og velg
                  «Hent fra lager» der.
                </p>
              </>
            )}

            {(job.status === 'shipped' || job.status === 'delivered') && (
              <KV
                items={[
                  { label: 'Sendt', value: datoTid(job.shipped_at) },
                  ...(job.status === 'delivered' ? [{ label: 'Levert', value: datoTid(job.delivered_at) }] : []),
                  ...(delivery
                    ? [
                        { label: 'Transportør', value: delivery.carrier ?? '–' },
                        { label: 'Sporingsnummer', value: delivery.tracking_reference ?? '–' },
                      ]
                    : []),
                ]}
              />
            )}

            {job.status === 'cancelled' && <p className="pt-hint">Jobben er kansellert.</p>}

            {job.status === 'shipped' && <DeliverButton jobId={job.id} thing={thing} shipped />}

            {isAdmin && !closed && (
              <div style={{ marginTop: '1rem' }}>
                <ActionButton
                  action={cancelJob}
                  fields={{ job: job.id }}
                  label="Kanseller jobben"
                  pendingLabel="Kansellerer…"
                  tone="danger"
                  confirm={
                    stocked
                      ? `Kansellere jobb ${job.job_number}? Enheten blir stående i lagerbeholdningen: registrer svinn på lagervaren hvis den er kassert. Dette kan ikke angres.`
                      : `Kansellere jobb ${job.job_number}? Dette kan ikke angres.`
                  }
                />
              </div>
            )}
          </Card>

          {isAdmin && !closed && !stocked && (
            <Card title="Frist og spesielle krav" description="Bare administratorer kan endre dette.">
              <PortalForm action={updateJob} submitLabel="Lagre" resetOnSuccess={false}>
                <input type="hidden" name="job" value={job.id} />
                <div className="pt-field">
                  <label htmlFor="job-due">Frist</label>
                  <input id="job-due" name="due_date" type="date" defaultValue={job.due_date ?? ''} />
                </div>
                {/* Trinn følger produktet. Bare der de ikke er gitt, settes de for hånd. */}
                {!cabinetJob && (customJob || job.steps === null) && (
                  <div className="pt-field">
                    <label htmlFor="job-steps">Antall trinn</label>
                    <input
                      id="job-steps"
                      name="steps"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={200}
                      defaultValue={job.steps ?? ''}
                    />
                    <small>Fylles inn når antallet er avklart. Vises i spesifikasjonen og på tavla.</small>
                  </div>
                )}
                <div className="pt-field">
                  <label htmlFor="job-notes">Spesielle krav</label>
                  <textarea id="job-notes" name="spec_notes" maxLength={2000} defaultValue={job.spec_notes ?? ''} />
                </div>
              </PortalForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
