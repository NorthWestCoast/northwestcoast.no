import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { SearchForm } from '@/components/admin/fields';
import CompanyFields from '@/components/admin/company-fields';
import VesselInputs from '@/components/portal/vessel-inputs';
import { createCompany } from '../actions';
import { anyColumnMatches, searchTerm } from '../_lib/search';

export default async function SelskapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = searchTerm((await searchParams).q);
  const { supabase } = await requireStaff();

  let query = supabase
    .from('companies')
    .select('id, name, org_number, city, contact_name, contact_email, contact_phone, verified_at, vessels(count), ladders(count)')
    .order('name')
    .limit(300);
  if (q) query = query.or(anyColumnMatches(['name', 'org_number', 'contact_name', 'contact_email', 'city'], q));

  const [{ data: companies }, { data: withOrgNumber }] = await Promise.all([
    query,
    // Til dublettkontrollen i «Ny kunde»: alle som har organisasjonsnummer.
    supabase.from('companies').select('id, name, org_number').not('org_number', 'is', null).limit(5000),
  ]);
  const known = (withOrgNumber ?? []).flatMap((company) =>
    company.org_number ? [{ id: company.id, name: company.name, orgNumber: company.org_number }] : [],
  );

  return (
    <>
      <PageHeader
        title="Selskap"
        description="Kundene: rederier og andre som eier fartøy og leidere."
      />

      <Card flush>
        <Disclosure summary="Ny kunde">
          <PortalForm action={createCompany} submitLabel="Opprett kunde" pendingLabel="Oppretter…">
            <CompanyFields scope="new" lookup={{ known, vesselPrefix: 'vessel_' }} />
            {/* Fylles ut av «Finn kunde via fartøy», eller for hånd. Uten navn opprettes ikke noe fartøy. */}
            <details className="pt-fold">
              <summary>Legg til et fartøy samtidig (valgfritt)</summary>
              <div className="pt-form">
                <p className="pt-hint">
                  Fartøyet opprettes sammen med kunden. La navnet stå tomt hvis kunden ikke skal ha et fartøy nå.
                  Flere fartøy legger du til på kundens side etterpå.
                </p>
                <VesselInputs scope="new-vessel" prefix="vessel_" nameRequired={false} />
              </div>
            </details>
          </PortalForm>
        </Disclosure>
      </Card>

      <Card
        title={q ? `Treff på «${q}» (${companies?.length ?? 0})` : `Alle selskap (${companies?.length ?? 0})`}
        actions={<SearchForm action="/admin/selskap" q={q} placeholder="Søk på navn, org.nr. eller kontakt" />}
        flush
      >
        {companies?.length ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Navn</th><th>Org.nr.</th><th>Kontakt</th>
                <th className="pt-num">Fartøy</th><th className="pt-num">Leidere</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <Td label="Navn" className="pt-table-strong">
                    <Link href={`/admin/selskap/${company.id}`}>{company.name}</Link>
                    {!company.verified_at && <> <Badge tone="warn">Ikke verifisert</Badge></>}
                  </Td>
                  <Td label="Org.nr." className="pt-nowrap">{company.org_number ?? '–'}</Td>
                  <Td label="Kontakt">
                    {company.contact_name || company.contact_email || company.contact_phone ? (
                      <div>
                        {company.contact_name && <div>{company.contact_name}</div>}
                        {company.contact_email && <div className="pt-hint">{company.contact_email}</div>}
                        {company.contact_phone && <div className="pt-hint">{company.contact_phone}</div>}
                      </div>
                    ) : '–'}
                  </Td>
                  <Td label="Fartøy" className="pt-num">{company.vessels[0]?.count ?? 0}</Td>
                  <Td label="Leidere" className="pt-num">{company.ladders[0]?.count ?? 0}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title={q ? 'Ingen selskap passer med søket' : 'Ingen selskap registrert ennå'}>
            {q ? <Link href="/admin/selskap" className="pt-link">Vis alle</Link> : 'Opprett det første selskapet over.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
