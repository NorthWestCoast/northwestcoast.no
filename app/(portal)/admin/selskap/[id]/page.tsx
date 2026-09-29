import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import ActionForm from '@/components/action-form';
import { createVessel, inviteMember } from '../../actions';

export default async function SelskapDetaljPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, org_number, address, postal_code, city')
    .eq('id', id)
    .maybeSingle();

  if (!company) notFound();

  const [{ data: vessels }, { data: invitations }, { data: members }] = await Promise.all([
    supabase.from('vessels').select('id, name, imo, vessel_type').eq('company_id', id).order('name'),
    supabase
      .from('company_invitations')
      .select('id, email, role, accepted_at, expires_at')
      .eq('company_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('company_members').select('user_id, role').eq('company_id', id),
  ]);

  return (
    <>
      <h1>{company.name}</h1>
      <p className="adm-hint">
        {[company.org_number, company.address, company.postal_code, company.city]
          .filter(Boolean)
          .join(' · ') || 'Ingen kontaktopplysninger registrert'}
      </p>

      <section className="adm-section">
        <h2>Fartøy ({vessels?.length ?? 0})</h2>
        {vessels?.length ? (
          <table className="adm-table">
            <thead><tr><th>Navn</th><th>IMO</th><th>Type</th></tr></thead>
            <tbody>
              {vessels.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.imo ?? '–'}</td>
                  <td>{v.vessel_type ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen fartøy registrert.</p>
        )}

        <h3>Nytt fartøy</h3>
        <ActionForm action={createVessel} submitLabel="Legg til fartøy">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="adm-grid">
            <label>Navn *<input name="name" required placeholder="MS Havbris" /></label>
            <label>
              IMO
              <input name="imo" placeholder="9074729" inputMode="numeric" />
            </label>
            <label>Kallesignal<input name="call_sign" /></label>
            <label>Type<input name="vessel_type" placeholder="Fiskefartøy" /></label>
            <label>Hjemmehavn<input name="home_port" /></label>
          </div>
          <p className="adm-hint">
            IMO er valgfritt – fartøy under 15 m har ofte ikke ett. Oppgis det,
            valideres kontrollsifferet: feil IMO gir feil fartøy på los-siden.
          </p>
        </ActionForm>
      </section>

      <section className="adm-section">
        <h2>Tilgang</h2>
        <p className="adm-hint">
          {members?.length ?? 0} innlogget bruker(e). Invitasjonen løses inn
          første gang personen logger inn med adressen sin.
        </p>

        {invitations?.length ? (
          <table className="adm-table">
            <thead><tr><th>E-post</th><th>Rolle</th><th>Status</th></tr></thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>{inv.role}</td>
                  <td>
                    {inv.accepted_at ? (
                      <span className="adm-badge adm-badge-green">Aktiv</span>
                    ) : new Date(inv.expires_at) < new Date() ? (
                      <span className="adm-badge adm-badge-red">Utløpt</span>
                    ) : (
                      <span className="adm-badge adm-badge-amber">Venter</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen invitasjoner sendt.</p>
        )}

        <h3>Inviter person</h3>
        <ActionForm action={inviteMember} submitLabel="Send invitasjon">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="adm-grid">
            <label>E-post *<input name="email" type="email" required /></label>
            <label>
              Rolle
              <select name="role" defaultValue="member">
                <option value="member">Medlem</option>
                <option value="admin">Administrator</option>
                <option value="owner">Eier</option>
              </select>
            </label>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
