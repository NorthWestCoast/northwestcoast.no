import Link from 'next/link';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { ladderStatus } from '@/lib/portal/labels';
import { idag } from '@/lib/format';
import { LadderAccessForm } from '@/components/minside/forms';
import OwnRequestList from '@/components/minside/request-list';
import ServiceState from '@/components/minside/service-state';
import { meter } from '@/components/minside/util';
import { installLadder, requestLadderAccess } from '../actions';

/**
 * Alle leidere brukeren har tilgang til, uansett om tilgangen kommer fra
 * selskapet, fartøyet eller direkte på leideren.
 */
export default async function LeiderePage() {
  const { supabase, ctx } = await requireUser('/minside/leidere');

  const [
    { data: ladderRows },
    { data: requests },
    { data: vessels },
    { data: vesselRoles },
    { data: ladderRoles },
  ] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, product_number, length_m, vessel_id, vessel_name, company_id, company_name, status, service_state, next_service_due, days_until_service, open_tasks')
      .order('serial_number')
      .limit(500),
    supabase
      .from('ladder_access_requests')
      .select('id, ladder_id, serial_number, status, message, granted_role, decision_note, created_at, decided_at, ladders(serial_number)')
      .eq('requester_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('vessels').select('id, name, company_id').order('name'),
    supabase.from('vessel_members').select('vessel_id, role').eq('user_id', ctx.userId),
    supabase.from('ladder_members').select('ladder_id, role').eq('user_id', ctx.userId),
  ]);

  const ladders = (ladderRows ?? []).filter((l) => l.ladder_id);
  const isAdmin = ctx.staffRole === 'admin';
  const managedCompanyIds = new Set(managedCompanies(ctx).map((c) => c.id));
  const masterVesselIds = new Set((vesselRoles ?? []).filter((m) => m.role === 'master').map((m) => m.vessel_id));
  const managerLadderIds = new Set((ladderRoles ?? []).filter((m) => m.role === 'manager').map((m) => m.ladder_id));

  // Fartøy brukeren kan montere leidere på.
  const manageableVessels = (vessels ?? []).filter(
    (v) => isAdmin || managedCompanyIds.has(v.company_id) || masterVesselIds.has(v.id),
  );

  // Leverte leidere uten fartøy som brukeren selv kan montere.
  const toInstall = ladders.filter(
    (l) =>
      l.status === 'delivered' &&
      !l.vessel_id &&
      (isAdmin ||
        (l.company_id !== null && managedCompanyIds.has(l.company_id)) ||
        managerLadderIds.has(l.ladder_id as string)),
  );

  const today = idag();

  return (
    <>
      <PageHeader
        title="Leidere"
        description="Åpne en leider for å se historikk, loggføre vedlikehold, bestille service og dele tilstand med los."
        actions={<Link href="/minside/bestill" className="pt-btn">Bestill ny leider</Link>}
      />

      {toInstall.length > 0 && (
        <Card
          title="Monter på fartøy"
          description="Disse leiderne er levert, men ikke montert. Servicefristen begynner å løpe fra monteringsdatoen."
        >
          <div className="pt-stack">
            {toInstall.map((ladder) => {
              const options = manageableVessels.filter((v) => !ladder.company_id || v.company_id === ladder.company_id);
              return (
                <div key={ladder.ladder_id}>
                  <p>
                    <Link href={`/minside/leider/${ladder.ladder_id}`}><strong>{ladder.serial_number}</strong></Link>
                    {ladder.product_name ? ` · ${ladder.product_name}` : ''}
                  </p>
                  {options.length > 0 ? (
                    <PortalForm action={installLadder} submitLabel="Monter" tone="green">
                      <input type="hidden" name="ladder_id" value={ladder.ladder_id as string} />
                      <div className="pt-form-row">
                        <div className="pt-field">
                          <label htmlFor={`vessel-${ladder.ladder_id}`}>Fartøy</label>
                          <select id={`vessel-${ladder.ladder_id}`} name="vessel_id" required defaultValue={options.length === 1 ? options[0].id : ''}>
                            <option value="" disabled>Velg fartøy</option>
                            {options.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="pt-field">
                          <label htmlFor={`installed-${ladder.ladder_id}`}>Montert dato</label>
                          <input id={`installed-${ladder.ladder_id}`} name="installed_at" type="date" defaultValue={today} max={today} required />
                        </div>
                      </div>
                    </PortalForm>
                  ) : (
                    <p className="pt-hint">
                      Du har ingen fartøy å montere den på ennå. <Link href="/minside/fartoy">Legg til fartøyet</Link> først.
                    </p>
                  )}
                </div>
              );
            })}
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
                <th>Fartøy</th>
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
                    <Td label="Fartøy">
                      {ladder.vessel_id ? (
                        <Link href={`/minside/fartoy/${ladder.vessel_id}`}>{ladder.vessel_name ?? 'Fartøy'}</Link>
                      ) : (
                        <span className="pt-muted">{ladder.company_name ?? 'Ikke montert'}</span>
                      )}
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

      {requests && requests.length > 0 && (
        <Card title="Dine forespørsler" description="Forespørsler du har sendt om tilgang til leidere." flush>
          <OwnRequestList requests={requests} />
        </Card>
      )}
    </>
  );
}
