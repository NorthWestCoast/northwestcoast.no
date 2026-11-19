import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { Badge, Card, Disclosure, Empty, KV, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { uuid } from '@/lib/portal/forms';
import { VESSEL_ROLES, ladderStatus } from '@/lib/portal/labels';
import { InviteForm } from '@/components/minside/forms';
import InvitationList from '@/components/minside/invitation-list';
import { loadPeople, personName } from '@/components/minside/people';
import ServiceState from '@/components/minside/service-state';
import { meter } from '@/components/minside/util';
import { inviteToVessel, removeVesselMember, updateVessel } from '../actions';

export const metadata: Metadata = { title: 'Fartøy' };

/** Ett fartøy: opplysninger, leiderne om bord og hvem som har tilgang. */
export default async function FartoyDetaljPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase, ctx } = await requireUser(`/minside/fartoy/${id}`);

  const { data: vessel } = await supabase
    .from('vessels')
    .select('id, name, imo, call_sign, vessel_type, home_port, company_id, companies(name)')
    .eq('id', id)
    .maybeSingle();
  if (!vessel) notFound();

  const [{ data: ladders }, { data: members }] = await Promise.all([
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, length_m, status, service_state, next_service_due, days_until_service, open_tasks')
      .eq('vessel_id', id)
      .order('serial_number'),
    supabase.from('vessel_members').select('user_id, role, created_at').eq('vessel_id', id).order('created_at'),
  ]);

  // Styrer bare hva som vises. Fartøyet endres av selskapets eiere og
  // administratorer; skipper kan i tillegg invitere mannskap.
  const isCompanyAdmin =
    ctx.staffRole === 'admin' || managedCompanies(ctx).some((company) => company.id === vessel.company_id);
  const isMaster = (members ?? []).some((m) => m.user_id === ctx.userId && m.role === 'master');
  const canInvite = isCompanyAdmin || isMaster;

  const [people, { data: invitations }] = await Promise.all([
    loadPeople(supabase, (members ?? []).map((m) => m.user_id)),
    canInvite
      ? supabase
          .from('access_invitations')
          .select('id, email, role, created_at, expires_at, accepted_at, revoked_at')
          .eq('scope', 'vessel')
          .eq('vessel_id', id)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const companyName = vessel.companies?.name ?? null;

  return (
    <>
      <PageHeader
        title={vessel.name}
        description={[vessel.vessel_type, companyName].filter(Boolean).join(' · ') || undefined}
        crumbs={[{ href: '/minside/fartoy', label: 'Fartøy' }, { label: vessel.name }]}
      />

      <Card title="Opplysninger" flush>
        <div style={{ padding: '1.1rem' }}>
          <KV
            items={[
              { label: 'Navn', value: vessel.name },
              { label: 'IMO', value: vessel.imo },
              { label: 'Kallesignal', value: vessel.call_sign },
              { label: 'Type', value: vessel.vessel_type },
              { label: 'Hjemmehavn', value: vessel.home_port },
              { label: 'Selskap', value: companyName },
            ]}
          />
        </div>
        {isCompanyAdmin && (
          <Disclosure summary="Endre opplysninger">
            <PortalForm action={updateVessel} submitLabel="Lagre" resetOnSuccess={false}>
              <input type="hidden" name="vessel_id" value={vessel.id} />
              <div className="pt-form-row">
                <div className="pt-field">
                  <label htmlFor="vessel-name">Navn</label>
                  <input id="vessel-name" name="name" required minLength={2} maxLength={160} defaultValue={vessel.name} />
                </div>
                <div className="pt-field">
                  <label htmlFor="vessel-imo">IMO-nummer</label>
                  <input id="vessel-imo" name="imo" inputMode="numeric" maxLength={11} defaultValue={vessel.imo ?? ''} placeholder="7 siffer" />
                </div>
              </div>
              <div className="pt-form-row pt-form-row-3">
                <div className="pt-field">
                  <label htmlFor="vessel-call">Kallesignal</label>
                  <input id="vessel-call" name="call_sign" maxLength={20} defaultValue={vessel.call_sign ?? ''} autoCapitalize="characters" />
                </div>
                <div className="pt-field">
                  <label htmlFor="vessel-type">Type</label>
                  <input id="vessel-type" name="vessel_type" maxLength={80} defaultValue={vessel.vessel_type ?? ''} />
                </div>
                <div className="pt-field">
                  <label htmlFor="vessel-port">Hjemmehavn</label>
                  <input id="vessel-port" name="home_port" maxLength={80} defaultValue={vessel.home_port ?? ''} />
                </div>
              </div>
            </PortalForm>
          </Disclosure>
        )}
      </Card>

      <Card title="Leidere om bord" flush>
        {ladders && ladders.length > 0 ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Produksjonsnr.</th>
                <th>Produkt</th>
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
                    <Td label="Status"><div><Badge tone={status.tone}>{status.label}</Badge></div></Td>
                    <Td label="Service">
                      <div>
                        <ServiceState state={ladder.service_state} due={ladder.next_service_due} days={ladder.days_until_service} />
                      </div>
                    </Td>
                    <Td label="Åpne oppgaver">{ladder.open_tasks ?? 0}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen leidere på fartøyet" action={{ href: '/minside/leidere', label: 'Gå til leidere' }}>
            Leverte leidere monterer du på fartøyet under Leidere.
          </Empty>
        )}
      </Card>

      <Card
        title="Mannskap med tilgang"
        description={
          companyName
            ? `Alle i ${companyName} har tilgang til fartøyet. Her er de som er lagt til på akkurat dette fartøyet.`
            : 'Personer som er lagt til på akkurat dette fartøyet.'
        }
        flush
      >
        {members && members.length > 0 ? (
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
              {members.map((member) => {
                const person = people.get(member.user_id);
                const self = member.user_id === ctx.userId;
                return (
                  <tr key={member.user_id}>
                    <Td label="Navn" className="pt-table-strong">{personName(person)}{self ? ' (deg)' : ''}</Td>
                    <Td label="E-post">{person?.email ?? '–'}</Td>
                    <Td label="Rolle"><div><Badge>{VESSEL_ROLES[member.role] ?? member.role}</Badge></div></Td>
                    <Td>
                      {isCompanyAdmin && (
                        <ActionButton
                          action={removeVesselMember}
                          fields={{ vessel_id: vessel.id, user_id: member.user_id }}
                          label="Fjern"
                          tone="danger"
                          confirm={`Fjerne tilgangen til ${personName(person)}?`}
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen er lagt til på fartøyet">
            {canInvite ? 'Inviter skipper og mannskap under.' : 'Bare selskapets medlemmer har tilgang.'}
          </Empty>
        )}

        {canInvite && (
          <Disclosure summary="Inviter til fartøyet">
            <InviteForm
              action={inviteToVessel}
              fields={{ vessel_id: vessel.id }}
              roles={VESSEL_ROLES}
              defaultRole="crew"
              idPrefix="vessel-invite"
              submitLabel="Send invitasjon"
            />
          </Disclosure>
        )}
      </Card>

      {canInvite && invitations && invitations.length > 0 && (
        <Card title="Invitasjoner som venter" flush>
          <InvitationList invitations={invitations} roles={VESSEL_ROLES} />
        </Card>
      )}
    </>
  );
}
