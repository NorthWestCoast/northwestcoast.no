import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { Alert, Badge, Card, Disclosure, Empty, KV, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import ProjectFields from '@/components/portal/project-fields';
import { uuid } from '@/lib/portal/forms';
import { ladderStatus, projectKind, projectStatus } from '@/lib/portal/labels';
import { dato } from '@/lib/format';
import CabinetTable, { CABINET_COLUMNS } from '@/components/minside/cabinet-table';
import ServiceState from '@/components/minside/service-state';
import { meter } from '@/components/minside/util';
import { setProjectStatus, updateProject } from '../actions';

export const metadata: Metadata = { title: 'Prosjekt' };

/** Ett prosjekt: opplysningene, og leiderne og skapene som står der. */
export default async function ProsjektDetaljPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase, ctx } = await requireUser(`/minside/prosjekter/${id}`);

  // RLS: et prosjekt i et selskap brukeren ikke er med i finnes ikke for henne.
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, kind, location, description, status, company_id, created_at, companies(name)')
    .eq('id', id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: ladders }, { data: cabinets }] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, length_m, vessel_id, vessel_name, status, service_state, next_service_due, days_until_service, open_tasks')
      .eq('project_id', id)
      .order('serial_number'),
    supabase
      .from('cabinets')
      .select(CABINET_COLUMNS)
      .eq('project_id', id)
      .neq('status', 'retired')
      .order('created_at'),
  ]);

  // Styrer bare hva som vises. RLS gjør den samme vurderingen.
  const canManage =
    ctx.staffRole === 'admin' || managedCompanies(ctx).some((company) => company.id === project.company_id);

  const companyName = project.companies?.name ?? null;
  const kind = projectKind(project.kind);
  const status = projectStatus(project.status);
  const closed = project.status === 'closed';
  const equipment = (ladders?.length ?? 0) + (cabinets?.length ?? 0);

  return (
    <>
      <PageHeader
        title={project.name}
        description={[kind.label, project.location, companyName].filter(Boolean).join(' · ') || undefined}
        crumbs={[{ href: '/minside/prosjekter', label: 'Prosjekter' }, { label: project.name }]}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {closed && (
        <Alert tone="info" title="Prosjektet er avsluttet">
          Det kan ikke velges når utstyr plasseres.
          {equipment > 0 ? ' Utstyret under står fortsatt her til det blir flyttet eller tatt ned.' : ''}
        </Alert>
      )}

      <Card title="Opplysninger" flush>
        <div style={{ padding: '1.1rem' }}>
          <KV
            items={[
              { label: 'Navn', value: project.name },
              { label: 'Type', value: kind.label },
              { label: 'Sted', value: project.location },
              { label: 'Selskap', value: companyName },
              { label: 'Opprettet', value: dato(project.created_at) },
              { label: 'Status', value: status.label },
            ]}
          />
          {project.description && (
            <p style={{ marginTop: '0.9rem', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{project.description}</p>
          )}
        </div>
        {canManage && (
          <>
            <Disclosure summary="Endre opplysninger">
              <PortalForm action={updateProject} submitLabel="Lagre" resetOnSuccess={false}>
                <input type="hidden" name="project_id" value={project.id} />
                <ProjectFields scope="project" project={project} />
              </PortalForm>
            </Disclosure>
            <Disclosure summary={closed ? 'Åpne prosjektet igjen' : 'Avslutt prosjektet'}>
              <p className="pt-hint" style={{ marginBottom: '0.75rem' }}>
                {closed
                  ? 'Et åpent prosjekt kan velges igjen når leidere og skap plasseres.'
                  : 'Et avsluttet prosjekt blir stående med historikken sin, men kan ikke velges når utstyr plasseres. Flytt eller ta ned utstyret først hvis det ikke skal stå her lenger.'}
              </p>
              <ActionButton
                action={setProjectStatus}
                fields={{ project_id: project.id, status: closed ? 'active' : 'closed' }}
                label={closed ? 'Åpne igjen' : 'Avslutt prosjektet'}
                tone={closed ? 'ghost' : 'danger'}
                size="md"
                confirm={closed ? undefined : `Avslutte ${project.name}?`}
              />
            </Disclosure>
          </>
        )}
      </Card>

      <Card title={`Leidere (${ladders?.length ?? 0})`} flush>
        {ladders && ladders.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Produksjonsnr.</th>
                <th>Produkt</th>
                <th>Fartøy</th>
                <th>Status</th>
                <th>Service</th>
                <th>Åpne oppgaver</th>
              </tr>
            </thead>
            <tbody>
              {ladders.map((ladder) => {
                const ladderState = ladderStatus(ladder.status);
                return (
                  <tr key={ladder.ladder_id}>
                    <Td label="Produksjonsnr." className="pt-table-strong">
                      <Link href={`/minside/leider/${ladder.ladder_id}`}>{ladder.serial_number}</Link>
                    </Td>
                    <Td label="Produkt">
                      {[ladder.product_name, meter(ladder.length_m)].filter(Boolean).join(' · ') || '–'}
                    </Td>
                    <Td label="Fartøy">
                      {ladder.vessel_id
                        ? <Link href={`/minside/fartoy/${ladder.vessel_id}`}>{ladder.vessel_name ?? 'Fartøy'}</Link>
                        : '–'}
                    </Td>
                    <Td label="Status"><div><Badge tone={ladderState.tone}>{ladderState.label}</Badge></div></Td>
                    <Td label="Service">
                      <div>
                        <ServiceState state={ladder.service_state} due={ladder.next_service_due} days={ladder.days_until_service} />
                      </div>
                    </Td>
                    <Td label="Åpne oppgaver">{ladder.open_tasks ?? 0}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen leidere i prosjektet" action={{ href: '/minside/leidere', label: 'Gå til leidere' }}>
            Åpne leideren under Leidere, og velg dette prosjektet under «Plassering».
          </Empty>
        )}
      </Card>

      <Card title={`Oppbevaringsskap (${cabinets?.length ?? 0})`} flush>
        {cabinets && cabinets.length > 0 ? (
          <CabinetTable cabinets={cabinets} on="project" />
        ) : (
          <Empty title="Ingen skap i prosjektet" action={{ href: '/minside/leidere#skap', label: 'Gå til oppbevaringsskap' }}>
            Skapene står nederst på siden Leidere. Velg dette prosjektet når du plasserer eller flytter et skap.
          </Empty>
        )}
      </Card>
    </>
  );
}
