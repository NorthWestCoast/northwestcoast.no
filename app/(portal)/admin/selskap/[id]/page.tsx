import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Place } from '@/components/portal/placement';
import ProjectFields from '@/components/portal/project-fields';
import VesselFields from '@/components/portal/vessel-fields';
import { Hidden, Input, Select, Textarea } from '@/components/admin/fields';
import CompanyFields from '@/components/admin/company-fields';
import AgreementFields, { agreementStatus } from '@/components/admin/agreement-fields';
import InlineSelect from '@/components/admin/inline-select';
import {
  COMPANY_ROLES, cabinetStatus, ladderStatus, orderStatus, projectKind, projectStatus, serviceState, ticketStatusStaff,
} from '@/lib/portal/labels';
import { dato, datoTid, nok } from '@/lib/format';
import {
  createVessel, inviteToCompany, removeMember, revokeInvitation, setMemberRole, updateCompany,
} from '../../actions';
import { createAgreement, deleteAgreement, updateAgreement } from '../actions';
import { createProject } from '../../prosjekter/actions';

export default async function SelskapDetaljPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fartoy?: string }>;
}) {
  const { id: rawId } = await params;
  // Satt av «Ny kunde» når kunden ble opprettet, men fartøyet ikke lot seg lagre.
  const vesselFailed = (await searchParams).fartoy === 'feilet';
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireStaff();

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, org_number, address, postal_code, city, contact_name, contact_email, contact_phone')
    .eq('id', id)
    .maybeSingle();
  if (!company) notFound();

  const [
    { data: vessels }, { data: ladders }, { data: members }, { data: invitations },
    { data: agreements }, { data: orders }, { data: tickets },
    { data: projects }, { data: cabinets }, { data: withOrgNumber },
  ] = await Promise.all([
    supabase
      .from('vessels')
      .select('id, name, imo, call_sign, registration_mark, vessel_type, home_port, ladders(count)')
      .eq('company_id', id)
      .order('name'),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, status, vessel_id, vessel_name, project_id, project_name, next_service_due, service_state')
      .eq('company_id', id)
      .order('serial_number'),
    supabase.from('company_members').select('user_id, role, created_at').eq('company_id', id).order('created_at'),
    supabase
      .from('access_invitations')
      .select('id, email, role, invited_by_name, created_at, expires_at')
      .eq('company_id', id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_agreements')
      .select('id, title, starts_on, ends_on, interval_months, price_nok, covers, notes, status')
      .eq('company_id', id)
      .order('starts_on', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_number, created_at, total_nok, status')
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('support_tickets')
      .select('id, ticket_number, subject, status')
      .eq('company_id', id)
      .order('last_message_at', { ascending: false })
      .limit(50),
    supabase
      .from('projects')
      .select('id, name, kind, location, status, ladders(count), cabinets(count)')
      .eq('company_id', id)
      .order('status')
      .order('name'),
    supabase
      .from('cabinets')
      .select('id, serial_number, status, location_note, vessel_id, project_id, products(name), vessels(name), projects(name)')
      .eq('company_id', id)
      .order('created_at'),
    // Til dublettkontrollen når opplysningene hentes fra Brønnøysundregistrene.
    supabase.from('companies').select('id, name, org_number').not('org_number', 'is', null).limit(5000),
  ]);
  const known = (withOrgNumber ?? []).flatMap((other) =>
    other.org_number ? [{ id: other.id, name: other.name, orgNumber: other.org_number }] : [],
  );

  // company_members peker på auth.users, ikke profiles, så navnene hentes for seg.
  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from('profiles').select('user_id, full_name, email, last_seen_at').in('user_id', memberIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

  const companyId = { company_id: company.id };
  const now = Date.now();
  const place = [company.address, [company.postal_code, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <>
      <PageHeader
        title={company.name}
        crumbs={[{ href: '/admin/selskap', label: 'Selskap' }, { label: company.name }]}
        description={[company.org_number ? `Org.nr. ${company.org_number}` : null, place || null].filter(Boolean).join(' · ') || undefined}
      />

      {vesselFailed && (
        <Alert tone="warn" title="Kunden er opprettet, men fartøyet ble ikke lagret">
          Legg det til under «Nytt fartøy» nedenfor. Står IMO-nummeret alt på et annet fartøy, må det rettes der først.
        </Alert>
      )}

      <Card title="Opplysninger og kontakt">
        <PortalForm action={updateCompany} submitLabel="Lagre endringer" resetOnSuccess={false}>
          <Hidden fields={companyId} />
          <CompanyFields
            scope="company"
            company={company}
            lookup={{
              known,
              selfId: company.id,
              label: 'Hent fra Brønnøysundregistrene',
              hint: 'Velg et treff for å oppdatere navn, org.nr. og adresse. Ingenting lagres før du trykker «Lagre endringer».',
            }}
          />
        </PortalForm>
      </Card>

      <Card title={`Fartøy (${vessels?.length ?? 0})`} flush>
        {vessels?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Navn</th><th>IMO</th><th>Kallesignal</th><th>Type</th><th>Hjemmehavn</th><th className="pt-num">Leidere</th></tr>
            </thead>
            <tbody>
              {vessels.map((vessel) => (
                <tr key={vessel.id}>
                  <Td label="Navn" className="pt-table-strong">
                    <div>
                      <Link href={`/minside/fartoy/${vessel.id}`}>{vessel.name}</Link>
                      {vessel.registration_mark && <div className="pt-hint">{vessel.registration_mark}</div>}
                    </div>
                  </Td>
                  <Td label="IMO">{vessel.imo ?? '–'}</Td>
                  <Td label="Kallesignal">{vessel.call_sign ?? '–'}</Td>
                  <Td label="Type">{vessel.vessel_type ?? '–'}</Td>
                  <Td label="Hjemmehavn">{vessel.home_port ?? '–'}</Td>
                  <Td label="Leidere" className="pt-num">{vessel.ladders[0]?.count ?? 0}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen fartøy registrert" />
        )}
        <Disclosure summary="Nytt fartøy">
          <PortalForm action={createVessel} submitLabel="Legg til fartøy">
            <Hidden fields={companyId} />
            <VesselFields scope="vessel" />
          </PortalForm>
        </Disclosure>
      </Card>

      <Card
        title={`Prosjekter (${projects?.length ?? 0})`}
        description="Steder og oppdrag som ikke er et fartøy, for eksempel en kai eller et anlegg på land."
        flush
      >
        {projects?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Navn</th><th>Type</th><th>Sted</th><th className="pt-num">Leidere</th><th className="pt-num">Skap</th><th>Status</th></tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const status = projectStatus(project.status);
                return (
                  <tr key={project.id}>
                    <Td label="Navn" className="pt-table-strong">
                      <Link href={`/minside/prosjekter/${project.id}`}>{project.name}</Link>
                    </Td>
                    <Td label="Type">{projectKind(project.kind).label}</Td>
                    <Td label="Sted">{project.location ?? '–'}</Td>
                    <Td label="Leidere" className="pt-num">{project.ladders[0]?.count ?? 0}</Td>
                    <Td label="Skap" className="pt-num">{project.cabinets[0]?.count ?? 0}</Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen prosjekter" />
        )}
        <Disclosure summary="Nytt prosjekt">
          <PortalForm action={createProject} submitLabel="Opprett prosjekt">
            <Hidden fields={companyId} />
            <ProjectFields scope="project" />
          </PortalForm>
        </Disclosure>
      </Card>

      <Card
        title={`Leidere (${ladders?.length ?? 0})`}
        actions={<Link href="/admin/leidere" className="pt-btn pt-btn-ghost pt-btn-sm">Knytt leider til selskapet</Link>}
        flush
      >
        {ladders?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Produksjonsnr.</th><th>Produkt</th><th>Plassering</th><th>Status</th><th>Neste service</th></tr>
            </thead>
            <tbody>
              {ladders.map((ladder) => {
                const status = ladderStatus(ladder.status);
                const service = serviceState(ladder.service_state);
                return (
                  <tr key={ladder.ladder_id}>
                    <Td label="Produksjonsnr." className="pt-table-strong">
                      <Link href={`/minside/leider/${ladder.ladder_id}`}>{ladder.serial_number}</Link>
                    </Td>
                    <Td label="Produkt">{ladder.product_name}</Td>
                    <Td label="Plassering">
                      <div>
                        <Place
                          vesselId={ladder.vessel_id}
                          vesselName={ladder.vessel_name}
                          projectId={ladder.project_id}
                          projectName={ladder.project_name}
                        />
                      </div>
                    </Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td label="Neste service">
                      {ladder.next_service_due
                        ? <span>{dato(ladder.next_service_due)} <Badge tone={service.tone}>{service.label}</Badge></span>
                        : '–'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen leidere knyttet til selskapet" />
        )}
      </Card>

      <Card
        title={`Oppbevaringsskap (${cabinets?.length ?? 0})`}
        actions={<Link href="/admin/skap" className="pt-btn pt-btn-ghost pt-btn-sm">Registrer skap</Link>}
        flush
      >
        {cabinets?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Modell</th><th>Nummer</th><th>Plassering</th><th>Status</th></tr>
            </thead>
            <tbody>
              {cabinets.map((cabinet) => {
                const status = cabinetStatus(cabinet.status);
                return (
                  <tr key={cabinet.id}>
                    <Td label="Modell" className="pt-table-strong">
                      <Link href={`/admin/skap/${cabinet.id}`}>{cabinet.products?.name ?? 'Oppbevaringsskap'}</Link>
                    </Td>
                    <Td label="Nummer">{cabinet.serial_number ?? '–'}</Td>
                    <Td label="Plassering">
                      <div>
                        <div>
                          <Place
                            vesselId={cabinet.vessel_id}
                            vesselName={cabinet.vessels?.name}
                            projectId={cabinet.project_id}
                            projectName={cabinet.projects?.name}
                          />
                        </div>
                        {cabinet.location_note && <div className="pt-hint">{cabinet.location_note}</div>}
                      </div>
                    </Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen oppbevaringsskap">
            Skap dukker opp her når en bestilling med skap er levert.
          </Empty>
        )}
      </Card>

      <Card
        title={`Medlemmer (${members?.length ?? 0})`}
        description="Personer som kan logge inn og se selskapets fartøy, leidere og bestillinger."
        flush
      >
        {members?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Navn</th><th>E-post</th><th>Sist innlogget</th><th>Rolle</th><th /></tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const profile = profileById.get(member.user_id);
                const fields = { ...companyId, user_id: member.user_id };
                return (
                  <tr key={member.user_id}>
                    <Td label="Navn" className="pt-table-strong">{profile?.full_name ?? 'Uten navn'}</Td>
                    <Td label="E-post">{profile?.email ?? '–'}</Td>
                    <Td label="Sist innlogget">{profile?.last_seen_at ? datoTid(profile.last_seen_at) : 'Aldri'}</Td>
                    <Td>
                      <InlineSelect
                        action={setMemberRole}
                        fields={fields}
                        name="role"
                        label={`Rolle for ${profile?.full_name ?? profile?.email ?? 'medlemmet'}`}
                        options={COMPANY_ROLES}
                        defaultValue={member.role}
                      />
                    </Td>
                    <Td>
                      <ActionButton
                        action={removeMember}
                        fields={fields}
                        label="Fjern"
                        tone="danger"
                        confirm={`Fjerne ${profile?.full_name ?? profile?.email ?? 'medlemmet'} fra ${company.name}?`}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen medlemmer ennå">Inviter den første personen under.</Empty>
        )}

        <Disclosure summary="Inviter person" open={!members?.length && !invitations?.length}>
          <PortalForm action={inviteToCompany} submitLabel="Send invitasjon">
            <Hidden fields={companyId} />
            <div className="pt-form-row">
              <Input scope="invite" name="email" label="E-post" type="email" required maxLength={160} />
              <Select scope="invite" name="role" label="Rolle" defaultValue="member">
                {Object.entries(COMPANY_ROLES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <Textarea scope="invite" name="message" label="Melding (valgfritt)" rows={2} maxLength={500} />
            <p className="pt-hint">
              Tilgangen gjelder fra første gang personen logger inn med denne e-postadressen.
            </p>
          </PortalForm>
        </Disclosure>
      </Card>

      {Boolean(invitations?.length) && (
        <Card title="Invitasjoner som venter" flush>
          <table className="pt-table">
            <thead>
              <tr><th>E-post</th><th>Rolle</th><th>Invitert av</th><th>Sendt</th><th>Utløper</th><th /></tr>
            </thead>
            <tbody>
              {invitations?.map((invitation) => (
                <tr key={invitation.id}>
                  <Td label="E-post" className="pt-table-strong">{invitation.email}</Td>
                  <Td label="Rolle">{COMPANY_ROLES[invitation.role] ?? invitation.role}</Td>
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
        </Card>
      )}

      <Card title={`Serviceavtaler (${agreements?.length ?? 0})`} flush>
        {agreements?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Avtale</th><th>Periode</th><th>Intervall</th><th className="pt-num">Pris</th><th>Status</th></tr>
            </thead>
            <tbody>
              {agreements.map((agreement) => {
                const status = agreementStatus(agreement.status);
                return (
                  <tr key={agreement.id}>
                    <Td label="Avtale" className="pt-table-strong">{agreement.title}</Td>
                    <Td label="Periode">
                      {dato(agreement.starts_on)} – {agreement.ends_on ? dato(agreement.ends_on) : 'løpende'}
                    </Td>
                    <Td label="Intervall">Hver {agreement.interval_months}. måned</Td>
                    <Td label="Pris" className="pt-num">{agreement.price_nok === null ? '–' : nok(agreement.price_nok)}</Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen serviceavtale" />
        )}

        {agreements?.map((agreement) => (
          <Disclosure key={agreement.id} summary={`Endre «${agreement.title}»`}>
            <div className="pt-form">
              <PortalForm action={updateAgreement} submitLabel="Lagre avtalen" resetOnSuccess={false}>
                <Hidden fields={{ agreement_id: agreement.id }} />
                <AgreementFields scope={agreement.id} agreement={agreement} />
              </PortalForm>
              <div>
                <ActionButton
                  action={deleteAgreement}
                  fields={{ agreement_id: agreement.id }}
                  label="Slett avtalen"
                  tone="danger"
                  confirm={`Slette «${agreement.title}»? Dette kan ikke angres.`}
                />
              </div>
            </div>
          </Disclosure>
        ))}

        <Disclosure summary="Ny serviceavtale">
          <PortalForm action={createAgreement} submitLabel="Opprett avtale">
            <Hidden fields={companyId} />
            <AgreementFields scope="new-agreement" />
          </PortalForm>
        </Disclosure>
      </Card>

      <div className="pt-grid pt-grid-2">
        <Card title="Bestillinger" flush>
          {orders?.length ? (
            <table className="pt-table">
              <thead>
                <tr><th>Nr.</th><th>Dato</th><th className="pt-num">Sum</th><th>Status</th></tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const status = orderStatus(order.status);
                  return (
                    <tr key={order.id}>
                      <Td label="Nr." className="pt-table-strong">
                        <Link href={`/admin/bestillinger/${order.id}`}>{order.order_number}</Link>
                      </Td>
                      <Td label="Dato" className="pt-nowrap">{dato(order.created_at)}</Td>
                      <Td label="Sum" className="pt-num">{nok(order.total_nok)}</Td>
                      <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty title="Ingen bestillinger" />
          )}
        </Card>

        <Card title="Saker" flush>
          {tickets?.length ? (
            <table className="pt-table">
              <thead>
                <tr><th>Nr.</th><th>Emne</th><th>Status</th></tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const status = ticketStatusStaff(ticket.status);
                  return (
                    <tr key={ticket.id}>
                      <Td label="Nr." className="pt-nowrap">{ticket.ticket_number}</Td>
                      <Td label="Emne" className="pt-table-strong">
                        <Link href={`/admin/saker/${ticket.id}`}>{ticket.subject}</Link>
                      </Td>
                      <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty title="Ingen saker" />
          )}
        </Card>
      </div>
    </>
  );
}
