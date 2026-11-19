import type { Metadata } from 'next';
import { requireUser } from '@/lib/portal/context';
import { Card, Empty, PageHeader } from '@/components/portal/ui';
import { COMPANY_ROLES, LADDER_ROLES, VESSEL_ROLES } from '@/lib/portal/labels';
import PendingRequests from '@/components/minside/access-requests';
import InvitationList from '@/components/minside/invitation-list';
import OwnRequestList from '@/components/minside/request-list';

export const metadata: Metadata = { title: 'Forespørsler' };

const ALL_ROLES = { ...COMPANY_ROLES, ...VESSEL_ROLES, ...LADDER_ROLES };

/**
 * Tilgang: forespørsler som venter på brukeren, brukerens egne forespørsler
 * og invitasjonene hun har sendt.
 */
export default async function TilgangPage() {
  const { supabase, ctx } = await requireUser('/minside/tilgang');

  const [{ data: waiting }, { data: own }, { data: sent }] = await Promise.all([
    // RLS begrenser dette til leidere brukeren styrer.
    supabase
      .from('ladder_access_requests')
      .select('id, ladder_id, requester_name, requester_email, message, created_at, ladders(serial_number)')
      .eq('status', 'pending')
      .neq('requester_id', ctx.userId)
      .order('created_at')
      .limit(100),
    supabase
      .from('ladder_access_requests')
      .select('id, ladder_id, serial_number, status, message, granted_role, decision_note, created_at, decided_at, ladders(serial_number)')
      .eq('requester_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('access_invitations')
      .select('id, email, role, scope, created_at, expires_at, accepted_at, revoked_at, companies(name), vessels(name), ladders(serial_number)')
      .eq('invited_by', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const invitations = (sent ?? []).map((invitation) => ({
    ...invitation,
    target:
      invitation.scope === 'company' ? `Selskapet ${invitation.companies?.name ?? ''}`.trim()
      : invitation.scope === 'vessel' ? `Fartøyet ${invitation.vessels?.name ?? ''}`.trim()
      : `Leider ${invitation.ladders?.serial_number ?? ''}`.trim(),
  }));

  return (
    <>
      <PageHeader
        title="Forespørsler"
        description="Hvem ber om tilgang til leiderne dine, hva du selv har bedt om, og invitasjonene du har sendt."
      />

      <Card
        title="Venter på deg"
        description="Personer som har skrevet inn produksjonsnummeret på en leider du styrer."
        flush
      >
        {waiting && waiting.length > 0 ? (
          <PendingRequests requests={waiting} />
        ) : (
          <Empty title="Ingen forespørsler venter på deg" />
        )}
      </Card>

      <Card title="Dine forespørsler" flush>
        {own && own.length > 0 ? (
          <OwnRequestList requests={own} />
        ) : (
          <Empty title="Du har ikke bedt om tilgang til noen leidere" action={{ href: '/minside/leidere', label: 'Legg til leider' }} />
        )}
      </Card>

      <Card title="Invitasjoner du har sendt" flush>
        {invitations.length > 0 ? (
          <InvitationList invitations={invitations} roles={ALL_ROLES} />
        ) : (
          <Empty title="Du har ikke sendt noen invitasjoner">
            Du inviterer kolleger under Personer, mannskap på fartøyets side og enkeltpersoner på leiderens fane Tilgang.
          </Empty>
        )}
      </Card>
    </>
  );
}
