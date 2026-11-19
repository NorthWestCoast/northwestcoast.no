import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Disclosure, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { Input, SearchForm, Select, Textarea } from '@/components/admin/fields';
import { Place } from '@/components/portal/placement';
import { cabinetStatus } from '@/lib/portal/labels';
import { registerCabinet } from './actions';
import { searchTerm } from '../_lib/search';

export const metadata: Metadata = { title: 'Oppbevaringsskap' };

const STATUSES = ['in_production', 'delivered', 'installed', 'retired'] as const;

function href(status: string | undefined, q: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const query = params.toString();
  return query ? `/admin/skap?${query}` : '/admin/skap';
}

/**
 * Alle oppbevaringsskap med kunde, plassering og status. Skap fra
 * produksjonen dukker opp her når jobben leveres. Åpne et skap for å
 * plassere det, flytte det eller sette det som utrangert.
 */
export default async function SkapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = searchTerm(params.q);
  const status = STATUSES.find((value) => value === params.status);
  const { supabase } = await requireStaff();

  let query = supabase
    .from('cabinets')
    .select('id, serial_number, status, location_note, company_id, vessel_id, project_id, ladder_id, products(name, product_number), companies(name), vessels(name), projects(name), ladders(serial_number)')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (status) query = query.eq('status', status);

  const [{ data: rows }, { data: products }, { data: companies }] = await Promise.all([
    query,
    supabase
      .from('products')
      .select('id, product_number, name')
      .eq('kind', 'cabinet')
      .eq('active', true)
      .order('sort_order'),
    supabase.from('companies').select('id, name').order('name').limit(2000),
  ]);

  // Søket går på tvers av modell, nummer, kunde og plassering. Det meste av
  // det ligger i andre tabeller, så det gjøres her framfor i spørringen.
  const needle = q.toLowerCase();
  const cabinets = (rows ?? []).filter(
    (cabinet) =>
      !needle ||
      [
        cabinet.products?.name, cabinet.products?.product_number, cabinet.serial_number,
        cabinet.companies?.name, cabinet.vessels?.name, cabinet.projects?.name,
        cabinet.ladders?.serial_number, cabinet.location_note,
      ].some((value) => value?.toLowerCase().includes(needle)),
  );

  return (
    <>
      <PageHeader
        title="Oppbevaringsskap"
        description="Skapene som egne enheter. Et skap kan stå på et fartøy, i et prosjekt eller begge deler, også et annet sted enn leideren det ble levert sammen med."
      />

      <Card flush>
        <Disclosure summary="Registrer skap">
          <PortalForm action={registerCabinet} submitLabel="Registrer skap">
            <div className="pt-form-row pt-form-row-3">
              <Select scope="register" name="product_id" label="Modell" required defaultValue="">
                <option value="" disabled>Velg modell</option>
                {products?.map((product) => (
                  <option key={product.id} value={product.id}>{product.product_number} · {product.name}</option>
                ))}
              </Select>
              <Select scope="register" name="company_id" label="Kunde" defaultValue="">
                <option value="">Ingen ennå</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
              <Input
                scope="register"
                name="serial_number"
                label="Nummer (valgfritt)"
                maxLength={40}
                autoCapitalize="characters"
                hint="Bare hvis skapet har et eget nummer."
              />
            </div>
            <Textarea scope="register" name="notes" label="Notat (valgfritt)" rows={2} maxLength={2000} hint="Internt. Vises ikke for kunden." />
            <p className="pt-hint">
              Skap som bestilles og produseres, opprettes av seg selv når jobben leveres. Registrer for hånd bare
              skap som er levert utenom, og plasser dem etterpå ved å åpne skapet i lista under.
            </p>
          </PortalForm>
        </Disclosure>
      </Card>

      <Tabs
        current={href(status, q)}
        items={[
          { href: href(undefined, q), label: 'Alle' },
          ...STATUSES.map((value) => ({ href: href(value, q), label: cabinetStatus(value).label })),
        ]}
      />

      <Card
        title={q ? `Treff på «${q}» (${cabinets.length})` : `Skap (${cabinets.length})`}
        actions={<SearchForm action="/admin/skap" q={q} placeholder="Søk på modell, nummer, kunde eller sted" keep={{ status }} />}
        flush
      >
        {cabinets.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr><th>Modell</th><th>Nummer</th><th>Kunde</th><th>Plassering</th><th>Hører til leider</th><th>Status</th></tr>
            </thead>
            <tbody>
              {cabinets.map((cabinet) => {
                const state = cabinetStatus(cabinet.status);
                return (
                  <tr key={cabinet.id}>
                    <Td label="Modell" className="pt-table-strong">
                      <Link href={`/admin/skap/${cabinet.id}`}>{cabinet.products?.name ?? 'Oppbevaringsskap'}</Link>
                    </Td>
                    <Td label="Nummer" className="pt-nowrap">{cabinet.serial_number ?? '–'}</Td>
                    <Td label="Kunde">
                      {cabinet.company_id
                        ? <Link href={`/admin/selskap/${cabinet.company_id}`}>{cabinet.companies?.name ?? 'Kunde'}</Link>
                        : '–'}
                    </Td>
                    <Td label="Plassering">
                      <div>
                        <div>
                          <Place
                            vesselId={cabinet.vessel_id}
                            vesselName={cabinet.vessels?.name}
                            projectId={cabinet.project_id}
                            projectName={cabinet.projects?.name}
                          />
                        </div>
                        {cabinet.location_note && <div className="pt-hint">{cabinet.location_note}</div>}
                      </div>
                    </Td>
                    <Td label="Hører til leider">
                      {cabinet.ladder_id && cabinet.ladders
                        ? <Link href={`/minside/leider/${cabinet.ladder_id}`}>{cabinet.ladders.serial_number}</Link>
                        : '–'}
                    </Td>
                    <Td label="Status"><div><Badge tone={state.tone}>{state.label}</Badge></div></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={q || status ? 'Ingen skap passer med utvalget' : 'Ingen skap registrert ennå'}>
            {q || status
              ? <Link href="/admin/skap" className="pt-link">Vis alle</Link>
              : 'Skap dukker opp her når en produksjonsjobb med skap leveres.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
