import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import { Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Input, SearchForm, Select } from '@/components/admin/fields';
import { COMPANY_ROLES, LADDER_ROLES, VESSEL_ROLES, staffRoleLabel } from '@/lib/portal/labels';
import { dato, datoTid } from '@/lib/format';
import { inviteToCompany, revokeInvitation } from '../actions';
import { anyColumnMatches, searchTerm } from '../_lib/search';

const ROLE_LABELS: Record<string, Record<string, string>> = {
  company: COMPANY_ROLES,
  vessel: VESSEL_ROLES,
  ladder: LADDER_ROLES,
};

/** Alle som har logget inn, hvilke selskap de hører til, og invitasjoner som venter. */
export default async function BrukerePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = searchTerm((await searchParams).q);
  const { supabase } = await requireStaff();

  let profileQuery = supabase
    .from('profiles')
    .select('user_id, email, full_name, phone, title, last_seen_at')
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(300);
  if (q) profileQuery = profileQuery.or(anyColumnMatches(['full_name', 'email', 'phone', 'title'], q));

  const [{ data: profiles }, { data: staff }, { data: companies }, { data: invitations }] = await Promise.all([
    profileQuery,
    supabase.from('staff_members').select('email, role'),
    supabase.from('companies').select('id, name').order('name'),
    supabase
      .from('access_invitations')
      .select('id, email, scope, role, invited_by_name, created_at, expires_at, companies(id, name), vessels(name), ladders(serial_number)')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const userIds = (profiles ?? []).map((profile) => profile.user_id);
  const { data: memberships } = userIds.length
    ? await supabase.from('company_members').select('user_id, role, companies(id, name)').in('user_id', userIds)
    : { data: [] };

  const staffByEmail = new Map((staff ?? []).map((member) => [member.email.toLowerCase(), member.role]));
  type Membership = NonNullable<typeof memberships>[number];
  const membershipsByUser = new Map<string, Membership[]>();
  for (const membership of memberships ?? []) {
    const list = membershipsByUser.get(membership.user_id) ?? [];
    list.push(membership);
    membershipsByUser.set(membership.user_id, list);
  }
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Brukere"
        description="Alle som har logget inn på Min side. Tilgang til et selskap gis med en invitasjon."
      />

      <Card flush>
        <Disclosure summary="Inviter bruker">
          <PortalForm action={inviteToCompany} submitLabel="Send invitasjon">
            <div className="pt-form-row pt-form-row-3">
              <Input name="email" label="E-post" type="email" required maxLength={160} />
              <Select name="company_id" label="Selskap" required defaultValue="">
                <option value="" disabled>Velg selskap</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
              <Select name="role" label="Rolle" defaultValue="member">
                {Object.entries(COMPANY_ROLES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <p className="pt-hint">
              Tilgangen gjelder fra første gang personen logger inn med denne e-postadressen.
              Finnes ikke selskapet, opprett det først under <Link href="/admin/selskap" className="pt-link">Selskap</Link>.
            </p>
          </PortalForm>
        </Disclosure>
      </Card>

      <Card
        title={q ? `Treff på «${q}» (${profiles?.length ?? 0})` : `Brukere (${profiles?.length ?? 0})`}
        actions={<SearchForm action="/admin/brukere" q={q} placeholder="Søk på navn eller e-post" />}
        flush
      >
        {profiles?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Navn</th><th>E-post</th><th>Telefon</th><th>Stilling</th><th>Selskap og rolle</th><th>Sist sett</th></tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const staffRole = staffByEmail.get(profile.email.toLowerCase());
                const companiesOf = membershipsByUser.get(profile.user_id) ?? [];
                return (
                  <tr key={profile.user_id}>
                    <Td label="Navn" className="pt-table-strong">
                      <span>
                        {profile.full_name ?? 'Uten navn'}
                        {staffRole && <> <Badge tone="info">NorthWest Coast: {staffRoleLabel(staffRole).label}</Badge></>}
                      </span>
                    </Td>
                    <Td label="E-post">{profile.email}</Td>
                    <Td label="Telefon">{profile.phone ?? '–'}</Td>
                    <Td label="Stilling">{profile.title ?? '–'}</Td>
                    <Td label="Selskap og rolle">
                      {companiesOf.length ? (
                        <div>
                          {companiesOf.map((membership) => (
                            <div key={membership.companies.id}>
                              <Link href={`/admin/selskap/${membership.companies.id}`}>{membership.companies.name}</Link>
                              <span className="pt-muted"> ({COMPANY_ROLES[membership.role]})</span>
                            </div>
                          ))}
                        </div>
                      ) : '–'}
                    </Td>
                    <Td label="Sist sett">{profile.last_seen_at ? datoTid(profile.last_seen_at) : 'Aldri'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={q ? 'Ingen brukere passer med søket' : 'Ingen brukere ennå'}>
            {q && <Link href="/admin/brukere" className="pt-link">Vis alle</Link>}
          </Empty>
        )}
      </Card>

      <Card
        title={`Invitasjoner som venter (${invitations?.length ?? 0})`}
        description="Invitasjoner til selskap, fartøy og leidere som ikke er tatt i bruk ennå."
        flush
      >
        {invitations?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>E-post</th><th>Gjelder</th><th>Rolle</th><th>Invitert av</th><th>Sendt</th><th>Utløper</th><th /></tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <Td label="E-post" className="pt-table-strong">{invitation.email}</Td>
                  <Td label="Gjelder">
                    {invitation.companies
                      ? <Link href={`/admin/selskap/${invitation.companies.id}`}>{invitation.companies.name}</Link>
                      : invitation.vessels
                        ? `Fartøy: ${invitation.vessels.name}`
                        : invitation.ladders
                          ? `Leider: ${invitation.ladders.serial_number}`
                          : '–'}
                  </Td>
                  <Td label="Rolle">{ROLE_LABELS[invitation.scope]?.[invitation.role] ?? invitation.role}</Td>
                  <Td label="Invitert av">{invitation.invited_by_name ?? '–'}</Td>
                  <Td label="Sendt" className="pt-nowrap">{dato(invitation.created_at)}</Td>
                  <Td label="Utløper">
                    {new Date(invitation.expires_at).getTime() < now
                      ? <Badge tone="danger">Utløpt {dato(invitation.expires_at)}</Badge>
                      : dato(invitation.expires_at)}
                  </Td>
                  <Td>
                    <ActionButton
                      action={revokeInvitation}
                      fields={{ invitation_id: invitation.id }}
                      label="Trekk tilbake"
                      tone="danger"
                      confirm={`Trekke tilbake invitasjonen til ${invitation.email}?`}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen invitasjoner venter" />
        )}
      </Card>
    </>
  );
}
