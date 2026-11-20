import { Alert, Card, PageHeader } from '@/components/portal/ui';
import type { PortalContext } from '@/lib/portal/context';
import { createCompany, requestLadderAccess } from '@/app/(portal)/minside/actions';
import { CompanyForm, LadderAccessForm } from './forms';
import Invitations from './invitations';
import OwnRequestList from './request-list';
import type { PortalSupabase } from './util';

/**
 * Første møte med Min side for en bruker uten tilgang til noe ennå:
 * registrer rederiet, eller be om tilgang til en leider som finnes.
 */
export default async function Onboarding({ supabase, ctx }: { supabase: PortalSupabase; ctx: PortalContext }) {
  const { data: requests } = await supabase
    .from('ladder_access_requests')
    .select('id, ladder_id, status, message, granted_role, decision_note, created_at, decided_at, ladders(serial_number)')
    .eq('requester_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <>
      <PageHeader
        title="Velkommen til Min side"
        description="Her følger du leiderne dine: service, vedlikeholdslogg, bestillinger og deling av tilstand med los."
      />

      <Invitations invitations={ctx.invitations} />

      {ctx.invitations.length === 0 && (
        <Alert tone="info" title="Er du invitert av en kollega?">
          Da dukker invitasjonen opp her når du er logget inn med e-postadressen den ble sendt til,
          og du får tilgang når du har godtatt den. Du er logget inn som {ctx.email}.
        </Alert>
      )}

      <div className="pt-grid pt-grid-2">
        <Card
          title="Registrer rederiet"
          description="For deg som eier eller administrerer fartøy. Du blir eier av selskapet og kan invitere andre."
        >
          <CompanyForm action={createCompany} />
        </Card>

        <Card
          title="Har du allerede en leider?"
          description="Skriv inn produksjonsnummeret, så sender vi en forespørsel til den som styrer tilgangen."
        >
          <LadderAccessForm action={requestLadderAccess} />
        </Card>
      </div>

      {requests && requests.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <Card title="Dine forespørsler" flush>
            <OwnRequestList requests={requests} />
          </Card>
        </div>
      )}
    </>
  );
}
