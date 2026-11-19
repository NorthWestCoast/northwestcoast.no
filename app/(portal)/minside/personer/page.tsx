import type { Metadata } from 'next';
import { requireUser } from '@/lib/portal/context';
import { Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { COMPANY_ROLES } from '@/lib/portal/labels';
import { InviteForm } from '@/components/minside/forms';
import InvitationList from '@/components/minside/invitation-list';
import { loadPeople, personName } from '@/components/minside/people';
import { changeMemberRole, inviteToCompany, removeCompanyMember } from './actions';

export const metadata: Metadata = { title: 'Personer' };

/** Hvem som er med i selskapene, og invitasjoner til nye kolleger. */
export default async function PersonerPage() {
  const { supabase, ctx } = await requireUser('/minside/personer');

  const companyIds = ctx.companies.map((company) => company.id);
  const managedIds = ctx.companies.filter((c) => c.role === 'owner' || c.role === 'admin').map((c) => c.id);

  const [{ data: members }, { data: invitations }] = await Promise.all([
    companyIds.length
      ? supabase.from('company_members').select('company_id, user_id, role, created_at').in('company_id', companyIds).order('created_at')
      : Promise.resolve({ data: [] }),
    managedIds.length
      ? supabase
          .from('access_invitations')
          .select('id, company_id, email, role, created_at, expires_at, accepted_at, revoked_at')
          .eq('scope', 'company')
          .in('company_id', managedIds)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const people = await loadPeople(supabase, (members ?? []).map((m) => m.user_id));

  return (
    <>
      <PageHeader
        title="Personer"
        description="Alle i selskapet ser selskapets fartøy og leidere. Eiere og administratorer kan invitere, endre roller og gi tilgang videre."
      />

      {ctx.companies.length === 0 && (
        <Card>
          <Empty title="Du er ikke med i noe selskap" action={{ href: '/minside/profil', label: 'Registrer et selskap' }}>
            Tilgang til enkeltfartøy og enkeltleidere styres på fartøyets og leiderens egen side.
          </Empty>
        </Card>
      )}

      {ctx.companies.map((company) => {
        const canManage = company.role === 'owner' || company.role === 'admin';
        const isOwner = company.role === 'owner';
        const companyMembers = (members ?? []).filter((m) => m.company_id === company.id);
        const owners = companyMembers.filter((m) => m.role === 'owner').length;
        const pending = (invitations ?? []).filter((i) => i.company_id === company.id);
        // Bare eiere kan dele ut eierrollen.
        const roles = isOwner
          ? COMPANY_ROLES
          : Object.fromEntries(Object.entries(COMPANY_ROLES).filter(([value]) => value !== 'owner'));

        return (
          <div key={company.id}>
            <Card
              title={company.name}
              description={`Din rolle: ${COMPANY_ROLES[company.role] ?? company.role}`}
              flush
            >
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Navn</th>
                    <th>E-post</th>
                    <th>Rolle</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {companyMembers.map((member) => {
                    const person = people.get(member.user_id);
                    const self = member.user_id === ctx.userId;
                    const lastOwner = member.role === 'owner' && owners <= 1;
                    // Administratorer kan ikke røre eiere, og den siste eieren står fast.
                    const editable = canManage && !lastOwner && (isOwner || member.role !== 'owner');
                    return (
                      <tr key={member.user_id}>
                        <Td label="Navn" className="pt-table-strong">{personName(person)}{self ? ' (deg)' : ''}</Td>
                        <Td label="E-post">{person?.email ?? '–'}</Td>
                        <Td label="Rolle">
                          {editable ? (
                            <PortalForm action={changeMemberRole} submitLabel="Lagre rolle" resetOnSuccess={false}>
                              <input type="hidden" name="company_id" value={company.id} />
                              <input type="hidden" name="user_id" value={member.user_id} />
                              <div className="pt-field">
                                <select name="role" defaultValue={member.role} aria-label={`Rolle for ${personName(person)}`}>
                                  {Object.entries(roles).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                              </div>
                            </PortalForm>
                          ) : (
                            <div><Badge tone={member.role === 'owner' ? 'info' : 'neutral'}>{COMPANY_ROLES[member.role] ?? member.role}</Badge></div>
                          )}
                        </Td>
                        <Td>
                          {editable && (
                            <ActionButton
                              action={removeCompanyMember}
                              fields={{ company_id: company.id, user_id: member.user_id }}
                              label={self ? 'Forlat selskapet' : 'Fjern'}
                              tone="danger"
                              confirm={
                                self
                                  ? `Forlate ${company.name}? Du mister tilgangen til selskapets fartøy og leidere.`
                                  : `Fjerne ${personName(person)} fra ${company.name}?`
                              }
                            />
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {canManage && (
                <Disclosure summary="Inviter en kollega">
                  <InviteForm
                    action={inviteToCompany}
                    fields={{ company_id: company.id }}
                    roles={roles}
                    defaultRole="member"
                    idPrefix={`invite-${company.id}`}
                    submitLabel="Send invitasjon"
                  />
                </Disclosure>
              )}
            </Card>

            {canManage && pending.length > 0 && (
              <Card title={`Invitasjoner som venter – ${company.name}`} flush>
                <InvitationList invitations={pending} roles={COMPANY_ROLES} />
              </Card>
            )}
          </div>
        );
      })}
    </>
  );
}
