import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Badge, Card, Disclosure, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Input, Select } from '@/components/admin/fields';
import InlineSelect from '@/components/admin/inline-select';
import { staffRoleLabel } from '@/lib/portal/labels';
import { dato } from '@/lib/format';
import { addStaff, removeStaff, setStaffRole } from './actions';
import { MEDIA_ACCESS, STAFF_ROLE_OPTIONS, STAFF_ROLE_VALUES } from './roles';

/** Hvem som har en rolle hos NorthWestCoast: ansatte, og eksterne som hjelper til med innholdet. */
export default async function AnsattePage() {
  const { supabase, ctx } = await requireStaff();

  const { data: staff } = await supabase
    .from('staff_members')
    .select('email, full_name, role, created_at')
    .order('role')
    .order('email');

  // «Har logget inn» = det finnes en profil med samme e-postadresse.
  const emails = (staff ?? []).map((member) => member.email);
  const { data: profiles } = emails.length
    ? await supabase.from('profiles').select('email').in('email', emails)
    : { data: [] };
  const loggedIn = new Set((profiles ?? []).map((profile) => profile.email.toLowerCase()));
  const me = ctx.email.toLowerCase();

  return (
    <>
      <PageHeader
        title="Ansatte og roller"
        description="Rollen følger e-postadressen. Legg til en kollega eller en ekstern person her, så får hun tilgang neste gang hun logger inn."
      />

      <Alert tone="info" title="Slik virker rollene">
        Tilgangen gjelder fra neste gang personen logger inn med e-postadressen som står her.
        Administratorer ser hele Admin og Produksjon. Produksjon ser bare /produksjon.
        {' '}{MEDIA_ACCESS}
      </Alert>

      <Card title={`Ansatte (${staff?.length ?? 0})`} flush>
        {staff?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>E-post</th><th>Navn</th><th>Rolle</th><th>Innlogging</th><th>Lagt til</th><th>Endre rolle</th><th /></tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const email = member.email.toLowerCase();
                return (
                  <tr key={member.email}>
                    <Td label="E-post" className="pt-table-strong">
                      <span>{member.email}{email === me ? ' (deg)' : ''}</span>
                    </Td>
                    <Td label="Navn">{member.full_name ?? '–'}</Td>
                    <Td label="Rolle">
                      <Badge tone={member.role === 'admin' ? 'info' : 'neutral'}>{staffRoleLabel(member.role).label}</Badge>
                    </Td>
                    <Td label="Innlogging">
                      {loggedIn.has(email) ? <Badge tone="ok">Har logget inn</Badge> : <Badge>Ikke logget inn ennå</Badge>}
                    </Td>
                    <Td label="Lagt til" className="pt-nowrap">{dato(member.created_at)}</Td>
                    <Td>
                      <InlineSelect
                        action={setStaffRole}
                        fields={{ email: member.email }}
                        name="role"
                        label={`Rolle for ${member.email}`}
                        options={STAFF_ROLE_OPTIONS}
                        defaultValue={member.role}
                      />
                    </Td>
                    <Td>
                      <ActionButton
                        action={removeStaff}
                        fields={{ email: member.email }}
                        label="Fjern"
                        tone="danger"
                        confirm={
                          email === me
                            ? 'Fjerne deg selv fra ansattlista? Du mister tilgangen til Admin.'
                            : `Fjerne ${member.email} fra ansattlista?`
                        }
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen ansatte på lista" />
        )}

        <Disclosure summary="Legg til ansatt eller ekstern person">
          <PortalForm action={addStaff} submitLabel="Legg til">
            <div className="pt-form-row pt-form-row-3">
              <Input name="email" label="E-post" type="email" required maxLength={160} />
              <Input name="full_name" label="Navn" maxLength={120} />
              <Select name="role" label="Rolle" defaultValue="production" hint={MEDIA_ACCESS}>
                {STAFF_ROLE_VALUES.map((role) => (
                  <option key={role} value={role}>{STAFF_ROLE_OPTIONS[role]}</option>
                ))}
              </Select>
            </div>
          </PortalForm>
        </Disclosure>
      </Card>
    </>
  );
}
