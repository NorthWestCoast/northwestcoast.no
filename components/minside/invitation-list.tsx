import { Badge } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import { dato } from '@/lib/format';
import { revokeInvitation } from '@/app/(portal)/minside/actions';
import { invitationStatus } from './util';

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  /** Hva invitasjonen gjelder, når listen går på tvers av flere mål. */
  target?: string | null;
};

/** Invitasjoner med status. De som venter kan trekkes tilbake. */
export default function InvitationList({
  invitations,
  roles,
}: {
  invitations: InvitationRow[];
  roles: Record<string, string>;
}) {
  return (
    <ul className="pt-list">
      {invitations.map((invitation) => {
        const status = invitationStatus(invitation);
        return (
          <li key={invitation.id}>
            <div className="pt-list-main">
              <strong>{invitation.email}</strong>
              <div className="pt-list-sub">
                {invitation.target ? `${invitation.target} · ` : ''}
                {roles[invitation.role] ?? invitation.role} · sendt {dato(invitation.created_at)}
                {status.open ? ` · gyldig til ${dato(invitation.expires_at)}` : ''}
              </div>
            </div>
            <div className="pt-list-side">
              <Badge tone={status.tone}>{status.label}</Badge>
              {status.open && (
                <ActionButton
                  action={revokeInvitation}
                  fields={{ invitation_id: invitation.id }}
                  label="Trekk tilbake"
                  tone="danger"
                  confirm={`Trekke tilbake invitasjonen til ${invitation.email}?`}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
