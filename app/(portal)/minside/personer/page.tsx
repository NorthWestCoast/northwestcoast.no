import { createServerSupabase } from '@/lib/supabase/server';
import ActionForm from '@/components/action-form';
import { inviteColleague } from '../actions';
import { dato } from '@/lib/format';

/**
 * Personer med tilgang.
 *
 * Invitasjonsskjemaet vises for alle, men RLS avgjør om innsendingen går
 * gjennom – bare administratorer og eiere får lov. Å skjule skjemaet for
 * andre ville krevd et rollekall til, og feilmeldingen fra serveren er
 * tydeligere enn et manglende skjema.
 */
export default async function PersonerPage() {
  const supabase = await createServerSupabase();

  const { data: companies } = await supabase.from('companies').select('id, name');
  const company = companies?.[0];

  if (!company) {
    return (
      <>
        <h1>Personer</h1>
        <p className="ms-muted">Kontoen din er ikke knyttet til et rederi ennå.</p>
      </>
    );
  }

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from('company_members').select('user_id, role, created_at').eq('company_id', company.id),
    supabase
      .from('company_invitations')
      .select('id, email, role, accepted_at, expires_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false }),
  ]);

  const ROLE_LABEL: Record<string, string> = {
    owner: 'Eier',
    admin: 'Administrator',
    member: 'Medlem',
  };

  return (
    <>
      <h1>Personer</h1>
      <p className="ms-muted ms-hint">
        {members?.length ?? 0} person(er) har tilgang til {company.name}.
      </p>

      <section className="ms-section">
        <h2>Tilganger</h2>
        {invitations?.length ? (
          <table className="ms-table">
            <thead><tr><th>E-post</th><th>Rolle</th><th>Status</th><th>Utløper</th></tr></thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>{ROLE_LABEL[inv.role] ?? inv.role}</td>
                  <td>
                    {inv.accepted_at ? (
                      <span className="ms-badge ms-badge-ok">Aktiv</span>
                    ) : new Date(inv.expires_at) < new Date() ? (
                      <span className="ms-badge ms-badge-overdue">Utløpt</span>
                    ) : (
                      <span className="ms-badge ms-badge-due_soon">Venter</span>
                    )}
                  </td>
                  <td>{inv.accepted_at ? '–' : dato(inv.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ms-muted">Ingen invitasjoner sendt ennå.</p>
        )}
      </section>

      <section className="ms-section">
        <h2>Inviter en kollega</h2>
        <p className="ms-muted ms-hint">
          Personen får en e-post og logger inn med adressen sin. Ingen passord
          å dele. Bare administratorer og eiere kan invitere.
        </p>
        <ActionForm action={inviteColleague} submitLabel="Send invitasjon">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="adm-grid">
            <label>E-post *<input name="email" type="email" required placeholder="kollega@rederi.no" /></label>
            <label>
              Rolle
              <select name="role" defaultValue="member">
                <option value="member">Medlem – kan se alt</option>
                <option value="admin">Administrator – kan også invitere</option>
              </select>
            </label>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
