import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Badge, Card, KV, PageHeader } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Hidden, Input, Select, Textarea } from '@/components/admin/fields';
import { loadAdminPlaces } from '@/components/admin/placement-options';
import { Place, PlacementFields } from '@/components/portal/placement';
import { cabinetStatus } from '@/lib/portal/labels';
import { dato, idag } from '@/lib/format';
import { placeCabinet, setCabinetRetired, updateCabinet } from '../actions';

export const metadata: Metadata = { title: 'Oppbevaringsskap' };

/** Ett oppbevaringsskap: kunde og plassering, nummer og notat, status. */
export default async function SkapDetaljPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireStaff();

  const { data: cabinet } = await supabase
    .from('cabinets')
    .select('id, serial_number, status, installed_at, location_note, notes, created_at, company_id, vessel_id, project_id, ladder_id, job_id, products(name, product_number), companies(name), vessels(name), projects(name), ladders(serial_number), production_jobs(job_number, order_number)')
    .eq('id', id)
    .maybeSingle();
  if (!cabinet) notFound();

  const places = await loadAdminPlaces(supabase, cabinet.project_id);

  const name = cabinet.products?.name ?? 'Oppbevaringsskap';
  const status = cabinetStatus(cabinet.status);
  const retired = cabinet.status === 'retired';
  const placed = Boolean(cabinet.vessel_id || cabinet.project_id);
  const fields = { cabinet_id: cabinet.id };
  const today = idag();

  return (
    <>
      <PageHeader
        title={name}
        description={[cabinet.serial_number ? `Nr. ${cabinet.serial_number}` : null, cabinet.companies?.name].filter(Boolean).join(' · ') || undefined}
        crumbs={[{ href: '/admin/skap', label: 'Oppbevaringsskap' }, { label: name }]}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <Card title="Opplysninger">
        <KV
          items={[
            { label: 'Modell', value: name },
            { label: 'Produktnr.', value: cabinet.products?.product_number },
            { label: 'Nummer', value: cabinet.serial_number },
            {
              label: 'Kunde',
              value: cabinet.company_id
                ? <Link href={`/admin/selskap/${cabinet.company_id}`}>{cabinet.companies?.name ?? 'Kunde'}</Link>
                : null,
            },
            {
              label: 'Plassering',
              value: (
                <Place
                  vesselId={cabinet.vessel_id}
                  vesselName={cabinet.vessels?.name}
                  projectId={cabinet.project_id}
                  projectName={cabinet.projects?.name}
                />
              ),
            },
            { label: 'Nøyaktig sted', value: cabinet.location_note },
            { label: 'Plassert', value: dato(cabinet.installed_at) },
            {
              label: 'Hører til leider',
              value: cabinet.ladder_id && cabinet.ladders
                ? <Link href={`/minside/leider/${cabinet.ladder_id}`}>{cabinet.ladders.serial_number}</Link>
                : null,
            },
            {
              label: 'Produksjonsjobb',
              value: cabinet.job_id && cabinet.production_jobs
                ? <Link href={`/produksjon/${cabinet.job_id}`}>{cabinet.production_jobs.job_number}</Link>
                : 'Registrert for hånd',
            },
            { label: 'Bestilling', value: cabinet.production_jobs?.order_number },
            { label: 'Registrert', value: dato(cabinet.created_at) },
          ]}
        />
      </Card>

      {!retired && (
        <Card
          title="Kunde og plassering"
          description="Velg fartøy, prosjekt eller begge. Kunden følger da med. Uten fartøy og prosjekt står skapet hos kunden, ikke plassert."
        >
          <div className="pt-form">
            <PortalForm action={placeCabinet} submitLabel="Lagre kunde og plassering" resetOnSuccess={false}>
              <Hidden fields={fields} />
              <Select scope="cabinet" name="company_id" label="Kunde" defaultValue={cabinet.company_id ?? ''}>
                <option value="">Ingen ennå</option>
                {places.companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
              <PlacementFields
                scope="cabinet"
                vessels={places.vessels}
                projects={places.projects}
                vesselId={cabinet.vessel_id}
                projectId={cabinet.project_id}
                date={cabinet.installed_at ?? today}
                maxDate={today}
                dateLabel="Plassert dato"
                dateRequired={false}
                location={{ value: cabinet.location_note }}
              />
            </PortalForm>
            {placed && (
              <p className="pt-hint">
                For å ta skapet ned velger du «Ikke på et fartøy» og «Ikke i et prosjekt», og lagrer.
              </p>
            )}
          </div>
        </Card>
      )}

      <Card title="Nummer og notat">
        <PortalForm action={updateCabinet} submitLabel="Lagre" resetOnSuccess={false}>
          <Hidden fields={fields} />
          <Input
            scope="cabinet"
            name="serial_number"
            label="Nummer (valgfritt)"
            maxLength={40}
            autoCapitalize="characters"
            defaultValue={cabinet.serial_number ?? ''}
          />
          <Textarea
            scope="cabinet"
            name="notes"
            label="Notat"
            rows={3}
            maxLength={2000}
            defaultValue={cabinet.notes ?? ''}
            hint="Internt. Vises ikke for kunden."
          />
        </PortalForm>
      </Card>

      <Card
        title={retired ? 'Utrangert' : 'Sett som utrangert'}
        description={
          retired
            ? 'Skapet er tatt ut av bruk og vises ikke hos kunden.'
            : 'Brukes når skapet er kassert eller byttet ut. Det tas ned fra fartøyet og prosjektet, og vises ikke lenger hos kunden.'
        }
      >
        <ActionButton
          action={setCabinetRetired}
          fields={{ ...fields, retired: retired ? 'false' : 'true' }}
          label={retired ? 'Ta i bruk igjen' : 'Sett som utrangert'}
          tone={retired ? 'ghost' : 'danger'}
          size="md"
          confirm={retired ? undefined : `Sette ${name} som utrangert?`}
        />
      </Card>
    </>
  );
}
