import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';
import ActionForm from '@/components/action-form';
import { createCompany } from '../actions';

export default async function SelskapPage() {
  const { supabase } = await requireStaff();

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, org_number, city')
    .order('name');

  return (
    <>
      <h1>Selskap</h1>

      <section className="adm-section">
        <h2>Nytt selskap</h2>
        <ActionForm action={createCompany} submitLabel="Opprett selskap">
          <div className="adm-grid">
            <label>Navn *<input name="name" required placeholder="Rederi AS" /></label>
            <label>
              Org.nr
              <input name="org_number" placeholder="998 196 159" inputMode="numeric" />
            </label>
            <label>Adresse<input name="address" /></label>
            <label>Postnr<input name="postal_code" inputMode="numeric" /></label>
            <label>Sted<input name="city" /></label>
          </div>
          <p className="adm-hint">
            Organisasjonsnummeret valideres med kontrollsiffer i databasen –
            tastefeil avvises før de blir en feilfakturering.
          </p>
        </ActionForm>
      </section>

      <section className="adm-section">
        <h2>Registrerte ({companies?.length ?? 0})</h2>
        {companies?.length ? (
          <table className="adm-table">
            <thead><tr><th>Navn</th><th>Org.nr</th><th>Sted</th><th /></tr></thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.org_number ?? '–'}</td>
                  <td>{c.city ?? '–'}</td>
                  <td><Link href={`/admin/selskap/${c.id}`}>Åpne →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="adm-empty">Ingen selskap registrert ennå.</p>
        )}
      </section>
    </>
  );
}
