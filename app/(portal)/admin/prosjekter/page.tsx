import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Disclosure, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { SearchForm, Select } from '@/components/admin/fields';
import ProjectFields from '@/components/portal/project-fields';
import { projectKind, projectStatus } from '@/lib/portal/labels';
import { setProjectStatus } from '@/app/(portal)/minside/prosjekter/actions';
import { createProject } from './actions';
import { searchTerm } from '../_lib/search';

export const metadata: Metadata = { title: 'Prosjekter' };

const STATUSES = ['active', 'closed'] as const;

function href(status: string | undefined, q: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const query = params.toString();
  return query ? `/admin/prosjekter?${query}` : '/admin/prosjekter';
}

/**
 * Alle prosjekter på tvers av kunder. Et prosjekt er et sted eller oppdrag
 * som ikke er et fartøy: en kai, et anlegg på land, et havbruksanlegg.
 * Hvert prosjekt åpnes på prosjektsiden på Min side, der det også endres.
 */
export default async function ProsjekterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = searchTerm(params.q);
  const status = STATUSES.find((value) => value === params.status);
  const { supabase } = await requireStaff();

  let query = supabase
    .from('projects')
    .select('id, name, kind, location, status, company_id, companies(name), ladders(count), cabinets(count)')
    .order('name')
    .limit(1000);
  if (status) query = query.eq('status', status);

  const [{ data: rows }, { data: companies }] = await Promise.all([
    query,
    supabase.from('companies').select('id, name').order('name').limit(2000),
  ]);

  // Søket går også på kundenavnet, som ligger i en annen tabell, så det
  // gjøres her framfor i spørringen.
  const needle = q.toLowerCase();
  const projects = (rows ?? []).filter(
    (project) =>
      !needle ||
      [project.name, project.location, project.companies?.name, projectKind(project.kind).label]
        .some((value) => value?.toLowerCase().includes(needle)),
  );

  return (
    <>
      <PageHeader
        title="Prosjekter"
        description="Steder og oppdrag som ikke er et fartøy: kaier, anlegg på land og havbruksanlegg. Åpne et prosjekt for å endre det og se utstyret som står der."
      />

      <Card flush>
        <Disclosure summary="Nytt prosjekt">
          {companies?.length ? (
            <PortalForm action={createProject} submitLabel="Opprett prosjekt">
              <Select scope="new-project" name="company_id" label="Kunde" required defaultValue="">
                <option value="" disabled>Velg kunde</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
              <ProjectFields scope="new-project" />
            </PortalForm>
          ) : (
            <p className="pt-hint">
              Et prosjekt tilhører en kunde. <Link href="/admin/selskap">Opprett kunden</Link> først.
            </p>
          )}
        </Disclosure>
      </Card>

      <Tabs
        current={href(status, q)}
        items={[
          { href: href(undefined, q), label: 'Alle' },
          ...STATUSES.map((value) => ({ href: href(value, q), label: value === 'active' ? 'Aktive' : 'Avsluttede' })),
        ]}
      />

      <Card
        title={q ? `Treff på «${q}» (${projects.length})` : `Prosjekter (${projects.length})`}
        actions={<SearchForm action="/admin/prosjekter" q={q} placeholder="Søk på navn, sted eller kunde" keep={{ status }} />}
        flush
      >
        {projects.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Prosjekt</th><th>Kunde</th><th>Type</th><th>Sted</th>
                <th className="pt-num">Leidere</th><th className="pt-num">Skap</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const state = projectStatus(project.status);
                const closed = project.status === 'closed';
                return (
                  <tr key={project.id}>
                    <Td label="Prosjekt" className="pt-table-strong">
                      <Link href={`/minside/prosjekter/${project.id}`}>{project.name}</Link>
                    </Td>
                    <Td label="Kunde">
                      <Link href={`/admin/selskap/${project.company_id}`}>{project.companies?.name ?? 'Kunde'}</Link>
                    </Td>
                    <Td label="Type">{projectKind(project.kind).label}</Td>
                    <Td label="Sted">{project.location ?? '–'}</Td>
                    <Td label="Leidere" className="pt-num">{project.ladders[0]?.count ?? 0}</Td>
                    <Td label="Skap" className="pt-num">{project.cabinets[0]?.count ?? 0}</Td>
                    <Td label="Status"><div><Badge tone={state.tone}>{state.label}</Badge></div></Td>
                    <Td>
                      <ActionButton
                        action={setProjectStatus}
                        fields={{ project_id: project.id, status: closed ? 'active' : 'closed' }}
                        label={closed ? 'Åpne igjen' : 'Avslutt'}
                        tone={closed ? 'ghost' : 'danger'}
                        confirm={closed ? undefined : `Avslutte ${project.name}? Utstyret blir stående, men prosjektet kan ikke velges ved ny plassering.`}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={q || status ? 'Ingen prosjekter passer med utvalget' : 'Ingen prosjekter ennå'}>
            {q || status
              ? <Link href="/admin/prosjekter" className="pt-link">Vis alle</Link>
              : 'Opprett det første prosjektet over, eller la kunden gjøre det selv på Min side.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
