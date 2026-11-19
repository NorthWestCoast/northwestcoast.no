import { Card } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import type { PortalInvitation } from '@/lib/portal/context';
import { acceptInvitation, declineInvitation } from '@/app/(portal)/minside/actions';
import { dato } from '@/lib/format';

const SCOPE: Record<PortalInvitation['scope'], string> = {
  company: 'selskapet',
  vessel: 'fartøyet',
  ladder: 'leideren',
};

/**
 * Invitasjoner som venter på svar.
 *
 * En invitasjon gir ingen tilgang før mottakeren selv har godtatt den. Ellers
 * kunne hvem som helst gjort en annen bruker til medlem i sitt eget selskap
 * bare ved å kjenne e-postadressen hennes.
 */
export default function Invitations({ invitations }: { invitations: PortalInvitation[] }) {
  if (invitations.length === 0) return null;

  return (
    <Card
      title={invitations.length === 1 ? 'Du har en invitasjon' : `Du har ${invitations.length} invitasjoner`}
      description="Godta bare invitasjoner fra noen du kjenner. Du får ingen tilgang, og deler ingenting, før du har godtatt."
    >
      <ul className="pt-list">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            <div className="pt-list-main">
              <strong>{invitation.target ?? 'Tilgang'}</strong>
              <div className="pt-list-sub">
                Tilgang til {SCOPE[invitation.scope] ?? 'en ressurs'}
                {invitation.invitedByName ? `, invitert av ${invitation.invitedByName}` : ''}.
                {invitation.expiresAt ? ` Gjelder til ${dato(invitation.expiresAt)}.` : ''}
              </div>
            </div>
            <div className="pt-actions">
              <ActionButton
                action={acceptInvitation}
                fields={{ invitation_id: invitation.id }}
                label="Godta"
                tone="green"
              />
              <ActionButton
                action={declineInvitation}
                fields={{ invitation_id: invitation.id }}
                label="Avslå"
                confirm="Avslå invitasjonen? Den som inviterte får beskjed."
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
