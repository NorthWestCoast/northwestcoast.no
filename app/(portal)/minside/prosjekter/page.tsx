import type { Metadata } from 'next';
import Link from 'next/link';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import ProjectFields from '@/components/portal/project-fields';
import { projectKind, projectStatus } from '@/lib/portal/labels';
import { createProject } from './actions';

export const metadata: Metadata = { title: 'Prosjekter' };

/** Prosjektene i selskapene brukeren er med i, og skjema for å opprette et nytt. */
export default async function ProsjekterPage() {
  const { supabase, ctx } = await requireUser('/minside/prosjekter');

  const [{ data: projects }, { data: ladders }, { data: cabinets }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, kind, location, status, company_id, companies(name)')
      .order('status')
      .order('name')
      .limit(500),
    supabase.from('ladder_status').select('ladder_id, project_id').not('project_id', 'is', null).limit(1000),
    supabase.from('cabinets').select('id, project_id').not('project_id', 'is', null).neq('status', 'retired').limit(1000),
  ]);

  const count = (rows: { project_id: string | null }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      if (row.project_id) map.set(row.project_id, (map.get(row.project_id) ?? 0) + 1);
    }
    return map;
  };
  const ladderCount = count(ladders);
  const cabinetCount = count(cabinets);

  const companies = managedCompanies(ctx);
  // Selskapet vises bare når det er noe å skille på.
  const showCompany = new Set((projects ?? []).map((p) => p.company_id)).size > 1 || ctx.staffRole === 'admin';

  return (
    <>
      <PageHeader
        title="Prosjekter"
        description="Et prosjekt er et sted eller oppdrag som ikke er et fartøy, for eksempel en kai eller et anlegg på land. Leidere og oppbevaringsskap kan stå i et prosjekt på samme måte som på et fartøy."
      />

      <Card flush>
        {projects && projects.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Prosjekt</th>
                <th>Type</th>
                <th>Sted</th>
                {showCompany && <th>Selskap</th>}
                <th>Leidere</th>
                <th>Skap</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const status = projectStatus(project.status);
                return (
                  <tr key={project.id}>
                    <Td label="Prosjekt" className="pt-table-strong">
                      <Link href={`/minside/prosjekter/${project.id}`}>{project.name}</Link>
                    </Td>
                    <Td label="Type">{projectKind(project.kind).label}</Td>
                    <Td label="Sted">{project.location ?? '–'}</Td>
                    {showCompany && <Td label="Selskap">{project.companies?.name ?? '–'}</Td>}
                    <Td label="Leidere">{ladderCount.get(project.id) ?? 0}</Td>
                    <Td label="Skap">{cabinetCount.get(project.id) ?? 0}</Td>
                    <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen prosjekter ennå">
            {companies.length > 0
              ? 'Opprett et prosjekt under når en leider eller et skap skal stå et annet sted enn på et fartøy.'
              : 'Du får se prosjekter her når du er medlem av selskapet de tilhører.'}
          </Empty>
        )}
      </Card>

      {companies.length > 0 ? (
        <Card flush>
          <Disclosure summary="Nytt prosjekt" open={!projects?.length}>
            <PortalForm action={createProject} submitLabel="Opprett prosjekt">
              {companies.length === 1 ? (
                <input type="hidden" name="company_id" value={companies[0].id} />
              ) : (
                <div className="pt-field">
                  <label htmlFor="project-company">Selskap</label>
                  <select id="project-company" name="company_id" required defaultValue={companies[0].id}>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <ProjectFields scope="project" />
            </PortalForm>
          </Disclosure>
        </Card>
      ) : (
        <p className="pt-hint">
          Bare eiere og administratorer i et selskap kan opprette prosjekter.
          {ctx.staffRole === 'admin' && (
            <> Som administrator i NorthWestCoast oppretter du prosjekter for kunder under{' '}
              <Link href="/admin/prosjekter">Admin</Link>.</>
          )}
        </p>
      )}
    </>
  );
}
