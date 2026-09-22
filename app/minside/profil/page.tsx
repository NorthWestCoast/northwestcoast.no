import { createServerSupabase } from '@/lib/supabase/server';
import ActionForm from '@/components/action-form';
import { updateCompanyProfile } from '../actions';

export default async function ProfilPage() {
  const supabase = await createServerSupabase();

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, org_number, address, postal_code, city, country');

  const company = companies?.[0];

  if (!company) {
    return (
      <>
        <h1>Profil</h1>
        <p className="ms-muted">Kontoen din er ikke knyttet til et rederi ennå.</p>
      </>
    );
  }

  return (
    <>
      <h1>Selskapsprofil</h1>

      <section className="ms-section">
        <ActionForm action={updateCompanyProfile} submitLabel="Lagre endringer">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="adm-grid">
            <label>Navn *<input name="name" defaultValue={company.name} required /></label>
            <label>Adresse<input name="address" defaultValue={company.address ?? ''} /></label>
            <label>Postnr<input name="postal_code" defaultValue={company.postal_code ?? ''} /></label>
            <label>Sted<input name="city" defaultValue={company.city ?? ''} /></label>
          </div>
          <p className="ms-muted ms-hint">
            Organisasjonsnummer ({company.org_number ?? 'ikke registrert'}) endres
            av NorthWest Coast – ta kontakt om det er feil.
            Bare administratorer og eiere kan lagre endringer.
          </p>
        </ActionForm>
      </section>
    </>
  );
}
