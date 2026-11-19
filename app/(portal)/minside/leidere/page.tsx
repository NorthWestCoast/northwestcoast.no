import Link from 'next/link';
import { requireUser } from '@/lib/portal/context';
import { Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { Place } from '@/components/portal/placement';
import { ladderStatus } from '@/lib/portal/labels';
import { idag } from '@/lib/format';
import CabinetTable, { CABINET_COLUMNS } from '@/components/minside/cabinet-table';
import { LadderAccessForm } from '@/components/minside/forms';
import { loadPlacementTargets, targetsFor } from '@/components/minside/placement';
import { CabinetPlacement, LadderPlacementForm } from '@/components/minside/placement-forms';
import OwnRequestList from '@/components/minside/request-list';
import ServiceState from '@/components/minside/service-state';
import { meter } from '@/components/minside/util';
import { requestLadderAccess } from '../actions';

/**
 * Alle leidere brukeren har tilgang til, uansett om tilgangen kommer fra
 * selskapet, fartøyet eller direkte på leideren. Under leiderne står
 * oppbevaringsskapene, som plasseres for seg.
 */
export default async function LeiderePage() {
  const { supabase, ctx } = await requireUser('/minside/leidere');

  const [
    { data: ladderRows },
    { data: requests },
    { data: ladderRoles },
    { data: cabinetRows },
    targets,
  ] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, product_number, length_m, vessel_id, vessel_name, project_id, project_name, company_id, company_name, status, installed_at, service_state, next_service_due, days_until_service, open_tasks')
      .order('serial_number')
      .limit(500),
    supabase
      .from('ladder_access_requests')
      .select('id, ladder_id, serial_number, status, message, granted_role, decision_note, created_at, decided_at, ladders(serial_number)')
      .eq('requester_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('ladder_members').select('ladder_id, role').eq('user_id', ctx.userId),
    supabase
      .from('cabinets')
      .select(CABINET_COLUMNS)
      .neq('status', 'retired')
      .order('created_at')
      .limit(500),
    loadPlacementTargets(supabase, ctx),
  ]);

  const ladders = (ladderRows ?? []).filter((l) => l.ladder_id);
  const cabinets = cabinetRows ?? [];
  const { isAdmin, managedCompanyIds } = targets;
  const managerLadderIds = new Set((ladderRoles ?? []).filter((m) => m.role === 'manager').map((m) => m.ladder_id));

  // Leverte leidere som ikke står noe sted, og som brukeren selv kan plassere.
  const toPlace = ladders.filter(
    (l) =>
      l.status === 'delivered' &&
      !l.vessel_id &&
      !l.project_id &&
      (isAdmin ||
        (l.company_id !== null && managedCompanyIds.has(l.company_id)) ||
        managerLadderIds.has(l.ladder_id as string)),
  );

  // Skap plasseres av eiere og administratorer i selskapet. Administratorer i
  // NorthWest Coast gjør det under Admin, der alle kunders skap står samlet.
  const placeableCabinets = cabinets.filter(
    (c) => c.company_id !== null && managedCompanyIds.has(c.company_id),
  );

  const today = idag();

  return (
    <>
      <PageHeader
        title="Leidere"
        description="Åpne en leider for å se historikk, loggføre vedlikehold, bestille service og dele tilstand med los."
        actions={<Link href="/minside/bestill" className="pt-btn">Bestill ny leider</Link>}
      />

      {toPlace.length > 0 && (
        <Card
          title="Velg plassering"
          description="Disse leiderne er levert, men ikke tatt i bruk. Velg fartøyet eller prosjektet de står på. Servicefristen begynner å løpe fra datoen."
        >
          <div className="pt-stack">
            {toPlace.map((ladder) => (
              <div key={ladder.ladder_id}>
                <p style={{ marginBottom: '0.6rem' }}>
                  <Link href={`/minside/leider/${ladder.ladder_id}`}><strong>{ladder.serial_number}</strong></Link>
                  {ladder.product_name ? ` · ${ladder.product_name}` : ''}
                </p>
                <LadderPlacementForm
                  ladder={{
                    id: ladder.ladder_id as string,
                    status: ladder.status,
                    vessel_id: ladder.vessel_id,
                    project_id: ladder.project_id,
                    installed_at: ladder.installed_at,
                  }}
                  options={targetsFor(targets, ladder.company_id)}
                  today={today}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card flush>
        {ladders.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Produksjonsnr.</th>
                <th>Produkt</th>
                <th>Plassering</th>
                <th>Status</th>
                <th>Service</th>
                <th>Åpne oppgaver</th>
              </tr>
            </thead>
            <tbody>
              {ladders.map((ladder) => {
                const status = ladderStatus(ladder.status);
                return (
                  <tr key={ladder.ladder_id}>
                    <Td label="Produksjonsnr." className="pt-table-strong">
                      <Link href={`/minside/leider/${ladder.ladder_id}`}>{ladder.serial_number}</Link>
                    </Td>
                    <Td label="Produkt">
                      {[ladder.product_name, meter(ladder.length_m)].filter(Boolean).join(' · ') || '–'}
                    </Td>
                    <Td label="Plassering">
                      <div>
                        <Place
                          vesselId={ladder.vessel_id}
                          vesselName={ladder.vessel_name}
                          projectId={ladder.project_id}
                          projectName={ladder.project_name}
                          empty={ladder.company_name ?? 'Ikke plassert'}
                        />
                      </div>
                    </Td>
                    <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
                    <Td label="Service">
                      <div>
                        <ServiceState state={ladder.service_state} due={ladder.next_service_due} days={ladder.days_until_service} />
                      </div>
                    </Td>
                    <Td label="Åpne oppgaver">
                      {ladder.open_tasks ? (
                        <Link href={`/minside/leider/${ladder.ladder_id}?fane=plan`}>{ladder.open_tasks}</Link>
                      ) : (
                        <span className="pt-muted">0</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen leidere ennå">
            Leidere du bestiller dukker opp her når de har fått produksjonsnummer. Har du en leider fra før,
            legger du den til med produksjonsnummeret under.
          </Empty>
        )}
      </Card>

      <Card flush>
        <Disclosure summary="Legg til leider" open={ladders.length === 0}>
          <p className="pt-hint" style={{ marginBottom: '0.9rem' }}>
            Skriv inn produksjonsnummeret som står på leideren. Den som styrer tilgangen til leideren
            godkjenner forespørselen. Har den ingen eier ennå, behandler NorthWest Coast den.
          </p>
          <LadderAccessForm action={requestLadderAccess} />
        </Disclosure>
      </Card>

      {cabinets.length > 0 && (
        <Card
          id="skap"
          title="Oppbevaringsskap"
          description={
            placeableCabinets.length > 0
              ? 'Skapene dine, og hvor de står. Et skap kan stå på et fartøy, i et prosjekt eller begge deler, uavhengig av leideren det kom sammen med.'
              : 'Skapene du har tilgang til, og hvor de står.'
          }
          flush
        >
          <CabinetTable cabinets={cabinets} />
          {placeableCabinets.map((cabinet) => (
            <CabinetPlacement
              key={cabinet.id}
              cabinet={cabinet}
              options={targetsFor(targets, cabinet.company_id, { vesselId: cabinet.vessel_id, projectId: cabinet.project_id })}
              today={today}
            />
          ))}
        </Card>
      )}

      {requests && requests.length > 0 && (
        <Card title="Dine forespørsler" description="Forespørsler du har sendt om tilgang til leidere." flush>
          <OwnRequestList requests={requests} />
        </Card>
      )}
    </>
  );
}
