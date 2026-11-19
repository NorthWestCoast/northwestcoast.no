import { Badge, Card, Disclosure, Empty, Td } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import { COMPANY_ROLES, LADDER_ROLES, VESSEL_ROLES } from '@/lib/portal/labels';
import { InviteForm } from '@/components/minside/forms';
import InvitationList from '@/components/minside/invitation-list';
import PendingRequests from '@/components/minside/access-requests';
import { loadPeople, personName } from '@/components/minside/people';
import { inviteToLadder, removeLadderMember } from '../actions';
import type { SectionProps } from './types';

type AccessRow = {
  key: string;
  userId: string;
  via: string;
  role: string;
  /** Bare direkte tilgang til leideren kan fjernes herfra. */
  removable: boolean;
};

/**
 * Tilgang: hvem som ser leideren, og hvorfor. Tilgang kan komme fra
 * eierselskapet, fra fartøyet eller være gitt direkte på leideren.
 */
export default async function Tilgang({ supabase, ctx, ladder, canManage }: SectionProps) {
  const id = ladder.ladder_id;

  const [{ data: companyMembers }, { data: vesselMembers }, { data: ladderMembers }, { data: invitations }, { data: requests }] =
    await Promise.all([
      ladder.company_id
        ? supabase.from('company_members').select('user_id, role').eq('company_id', ladder.company_id)
        : Promise.resolve({ data: [] }),
      ladder.vessel_id
        ? supabase.from('vessel_members').select('user_id, role').eq('vessel_id', ladder.vessel_id)
        : Promise.resolve({ data: [] }),
      supabase.from('ladder_members').select('user_id, role, created_at').eq('ladder_id', id).order('created_at'),
      canManage
        ? supabase
            .from('access_invitations')
            .select('id, email, role, created_at, expires_at, accepted_at, revoked_at')
            .eq('scope', 'ladder')
            .eq('ladder_id', id)
            .is('accepted_at', null)
            .is('revoked_at', null)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      canManage
        ? supabase
            .from('ladder_access_requests')
            .select('id, ladder_id, requester_name, requester_email, message, created_at, ladders(serial_number)')
            .eq('ladder_id', id)
            .eq('status', 'pending')
            .neq('requester_id', ctx.userId)
            .order('created_at')
        : Promise.resolve({ data: [] }),
    ]);

  const rows: AccessRow[] = [
    ...(companyMembers ?? []).map((m) => ({
      key: `company-${m.user_id}`,
      userId: m.user_id,
      via: ladder.company_name ? `Selskapet ${ladder.company_name}` : 'Eierselskapet',
      role: COMPANY_ROLES[m.role] ?? m.role,
      removable: false,
    })),
    ...(vesselMembers ?? []).map((m) => ({
      key: `vessel-${m.user_id}`,
      userId: m.user_id,
      via: ladder.vessel_name ? `Fartøyet ${ladder.vessel_name}` : 'Fartøyet',
      role: VESSEL_ROLES[m.role] ?? m.role,
      removable: false,
    })),
    ...(ladderMembers ?? []).map((m) => ({
      key: `ladder-${m.user_id}`,
      userId: m.user_id,
      via: 'Denne leideren',
      role: LADDER_ROLES[m.role] ?? m.role,
      removable: canManage || m.user_id === ctx.userId,
    })),
  ];

  const people = await loadPeople(supabase, rows.map((row) => row.userId));
  const pending = invitations ?? [];
  const waiting = requests ?? [];

  return (
    <>
      {waiting.length > 0 && (
        <Card title="Ber om tilgang" description="Disse har skrevet inn produksjonsnummeret og venter på svar fra deg." flush>
          <PendingRequests requests={waiting} showLadder={false} />
        </Card>
      )}

      <Card
        title="Hvem har tilgang"
        description={
          canManage
            ? 'Tilgang via selskap og fartøy endres under Personer og på fartøyets side.'
            : 'Du ser bare de tilgangene du selv har lov til å se.'
        }
        flush
      >
        {rows.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Navn</th>
                <th>E-post</th>
                <th>Tilgang via</th>
                <th>Rolle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const person = people.get(row.userId);
                const self = row.userId === ctx.userId;
                return (
                  <tr key={row.key}>
                    <Td label="Navn" className="pt-table-strong">
                      {personName(person)}{self ? ' (deg)' : ''}
                    </Td>
                    <Td label="E-post">{person?.email ?? '–'}</Td>
                    <Td label="Tilgang via">{row.via}</Td>
                    <Td label="Rolle"><div><Badge>{row.role}</Badge></div></Td>
                    <Td>
                      {row.removable && (
                        <ActionButton
                          action={removeLadderMember}
                          fields={{ ladder_id: id, user_id: row.userId }}
                          label={self ? 'Fjern min tilgang' : 'Fjern'}
                          tone="danger"
                          confirm={
                            self
                              ? 'Fjerne din egen tilgang til leideren? Du må be om tilgang på nytt for å se den igjen.'
                              : `Fjerne tilgangen til ${personName(person)}?`
                          }
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen tilganger å vise" />
        )}

        {canManage && (
          <Disclosure summary="Gi tilgang" open={rows.length <= 1}>
            <InviteForm
              action={inviteToLadder}
              fields={{ ladder_id: id }}
              roles={LADDER_ROLES}
              defaultRole="viewer"
              idPrefix="ladder-invite"
            />
          </Disclosure>
        )}
      </Card>

      {canManage && pending.length > 0 && (
        <Card title="Invitasjoner som venter" description="Tilgangen gjelder fra første gang den inviterte logger inn." flush>
          <InvitationList invitations={pending} roles={LADDER_ROLES} />
        </Card>
      )}
    </>
  );
}
