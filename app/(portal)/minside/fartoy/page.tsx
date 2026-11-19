import Link from 'next/link';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { createVessel } from './actions';

/** Fartøyene brukeren har tilgang til, og skjema for å legge til et nytt. */
export default async function FartoyPage() {
  const { supabase, ctx } = await requireUser('/minside/fartoy');

  const [{ data: vessels }, { data: ladders }] = await Promise.all([
    supabase
      .from('vessels')
      .select('id, name, imo, call_sign, vessel_type, home_port, company_id, companies(name)')
      .order('name')
      .limit(500),
    supabase.from('ladder_status').select('ladder_id, vessel_id, service_state').not('vessel_id', 'is', null).limit(1000),
  ]);

  const ladderCount = new Map<string, number>();
  const overdueCount = new Map<string, number>();
  for (const ladder of ladders ?? []) {
    if (!ladder.vessel_id) continue;
    ladderCount.set(ladder.vessel_id, (ladderCount.get(ladder.vessel_id) ?? 0) + 1);
    if (ladder.service_state === 'overdue') {
      overdueCount.set(ladder.vessel_id, (overdueCount.get(ladder.vessel_id) ?? 0) + 1);
    }
  }

  const companies = managedCompanies(ctx);

  return (
    <>
      <PageHeader
        title="Fartøy"
        description="Leidere monteres på et fartøy. Mannskap du gir tilgang til et fartøy, ser alle leiderne om bord."
      />

      <Card flush>
        {vessels && vessels.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Fartøy</th>
                <th>IMO</th>
                <th>Kallesignal</th>
                <th>Type</th>
                <th>Hjemmehavn</th>
                <th>Selskap</th>
                <th>Leidere</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((vessel) => {
                const overdue = overdueCount.get(vessel.id) ?? 0;
                return (
                  <tr key={vessel.id}>
                    <Td label="Fartøy" className="pt-table-strong">
                      <Link href={`/minside/fartoy/${vessel.id}`}>{vessel.name}</Link>
                    </Td>
                    <Td label="IMO">{vessel.imo ?? '–'}</Td>
                    <Td label="Kallesignal">{vessel.call_sign ?? '–'}</Td>
                    <Td label="Type">{vessel.vessel_type ?? '–'}</Td>
                    <Td label="Hjemmehavn">{vessel.home_port ?? '–'}</Td>
                    <Td label="Selskap">{vessel.companies?.name ?? '–'}</Td>
                    <Td label="Leidere">
                      {ladderCount.get(vessel.id) ?? 0}
                      {overdue > 0 ? ` (${overdue} med forfalt service)` : ''}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen fartøy ennå">
            {companies.length > 0
              ? 'Legg til det første fartøyet under.'
              : 'Du får se fartøy her når du er invitert til et, eller når du registrerer et selskap under Profil.'}
          </Empty>
        )}
      </Card>

      {companies.length > 0 ? (
        <Card flush>
          <Disclosure summary="Legg til fartøy" open={!vessels?.length}>
            <PortalForm action={createVessel} submitLabel="Legg til fartøy">
              {companies.length === 1 ? (
                <input type="hidden" name="company_id" value={companies[0].id} />
              ) : (
                <div className="pt-field">
                  <label htmlFor="vessel-company">Selskap</label>
                  <select id="vessel-company" name="company_id" required defaultValue={companies[0].id}>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pt-form-row">
                <div className="pt-field">
                  <label htmlFor="vessel-name">Navn</label>
                  <input id="vessel-name" name="name" required minLength={2} maxLength={160} placeholder="F.eks. MS Nordlys" />
                </div>
                <div className="pt-field">
                  <label htmlFor="vessel-imo">IMO-nummer (valgfritt)</label>
                  <input id="vessel-imo" name="imo" inputMode="numeric" maxLength={11} placeholder="7 siffer" />
                </div>
              </div>
              <div className="pt-form-row pt-form-row-3">
                <div className="pt-field">
                  <label htmlFor="vessel-call">Kallesignal</label>
                  <input id="vessel-call" name="call_sign" maxLength={20} autoCapitalize="characters" />
                </div>
                <div className="pt-field">
                  <label htmlFor="vessel-type">Type</label>
                  <input id="vessel-type" name="vessel_type" maxLength={80} placeholder="F.eks. Fiskefartøy" />
                </div>
                <div className="pt-field">
                  <label htmlFor="vessel-port">Hjemmehavn</label>
                  <input id="vessel-port" name="home_port" maxLength={80} />
                </div>
              </div>
            </PortalForm>
          </Disclosure>
        </Card>
      ) : (
        <p className="pt-hint">
          Bare eiere og administratorer i et selskap kan legge til fartøy. Registrer selskapet ditt under{' '}
          <Link href="/minside/profil">Profil</Link>, eller be en administrator om å legge det til.
        </p>
      )}
    </>
  );
}
