import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Empty, KV, PageHeader, Td } from '@/components/portal/ui';
import AccessDecision from '@/components/admin/access-decision';
import { LADDER_ROLES, requestStatus } from '@/lib/portal/labels';
import { dato, datoTid } from '@/lib/format';
import { decideAccess } from './actions';

const SELECT = 'id, created_at, message, requester_name, requester_email, status, granted_role, decided_at, decision_note, ladder_id, ladders(serial_number, companies(id, name), vessels(name))';

/**
 * Forespørsler om tilgang til en leider via produksjonsnummeret. Eieren av
 * leideren kan svare selv på Min side; her kan NorthWestCoast svare for alle.
 */
export default async function TilgangPage() {
  const { supabase } = await requireStaff();

  const [{ data: pending }, { data: decided }] = await Promise.all([
    supabase
      .from('ladder_access_requests')
      .select(SELECT)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('ladder_access_requests')
      .select(SELECT)
      .neq('status', 'pending')
      .order('decided_at', { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  return (
    <>
      <PageHeader
        title="Tilgangsforespørsler"
        description="Noen har skrevet inn et produksjonsnummer på Min side og bedt om å få se leideren."
      />

      {pending?.length ? (
        pending.map((request) => (
          <Card
            key={request.id}
            title={
              <>
                {request.requester_name ?? request.requester_email ?? 'Ukjent bruker'} ber om tilgang til{' '}
                <Link href={`/minside/leider/${request.ladder_id}`} className="pt-link">
                  {request.ladders?.serial_number ?? 'leideren'}
                </Link>
              </>
            }
          >
            <div className="pt-stack">
              <KV
                items={[
                  { label: 'E-post', value: request.requester_email ?? '–' },
                  { label: 'Mottatt', value: datoTid(request.created_at) },
                  {
                    label: 'Eier',
                    value: request.ladders?.companies
                      ? <Link href={`/admin/selskap/${request.ladders.companies.id}`}>{request.ladders.companies.name}</Link>
                      : 'Ikke knyttet til selskap',
                  },
                  { label: 'Fartøy', value: request.ladders?.vessels?.name ?? 'Ikke montert' },
                ]}
              />
              {request.message && (
                <div className="pt-bubble">
                  <div className="pt-bubble-head"><strong>Melding</strong></div>
                  <p>{request.message}</p>
                </div>
              )}
              <AccessDecision action={decideAccess} requestId={request.id} />
            </div>
          </Card>
        ))
      ) : (
        <Card>
          <Empty title="Ingen forespørsler venter" />
        </Card>
      )}

      <Card title="Nylig behandlet" flush>
        {decided?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Behandlet</th><th>Leider</th><th>Forespurt av</th><th>Utfall</th><th>Melding til brukeren</th></tr>
            </thead>
            <tbody>
              {decided.map((request) => {
                const status = requestStatus(request.status);
                return (
                  <tr key={request.id}>
                    <Td label="Behandlet" className="pt-nowrap">{dato(request.decided_at ?? request.created_at)}</Td>
                    <Td label="Leider" className="pt-table-strong">
                      <Link href={`/minside/leider/${request.ladder_id}`}>{request.ladders?.serial_number ?? 'Åpne'}</Link>
                    </Td>
                    <Td label="Forespurt av">{request.requester_name ?? request.requester_email ?? '–'}</Td>
                    <Td label="Utfall">
                      <span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {request.granted_role && <span className="pt-muted"> {LADDER_ROLES[request.granted_role]}</span>}
                      </span>
                    </Td>
                    <Td label="Melding til brukeren">{request.decision_note ?? '–'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen forespørsler er behandlet ennå" />
        )}
      </Card>
    </>
  );
}
