import type { Metadata } from 'next';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import { Card, Disclosure, PageHeader } from '@/components/portal/ui';
import { PortalForm } from '@/components/portal/forms';
import { COMPANY_ROLES } from '@/lib/portal/labels';
import { CompanyForm } from '@/components/minside/forms';
import { createCompany } from '../actions';
import { updateCompany, updateProfile } from './actions';

export const metadata: Metadata = { title: 'Profil' };

/** Egne opplysninger, varsler og selskapets kontaktinformasjon. */
export default async function ProfilPage() {
  const { supabase, ctx } = await requireUser('/minside/profil');

  const managed = managedCompanies(ctx);

  const [{ data: profile }, { data: companies }] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, title, notify_email').eq('user_id', ctx.userId).maybeSingle(),
    managed.length
      ? supabase
          .from('companies')
          .select('id, name, org_number, address, postal_code, city, contact_name, contact_email, contact_phone, verified_at')
          .in('id', managed.map((company) => company.id))
          .order('name')
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <PageHeader title="Profil" description="Navnet ditt vises på loggføringer, saker og rapporter du deler." />

      <Card title="Dine opplysninger">
        <PortalForm action={updateProfile} submitLabel="Lagre profil" resetOnSuccess={false}>
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="profile-name">Navn</label>
              <input id="profile-name" name="full_name" maxLength={120} defaultValue={profile?.full_name ?? ''} autoComplete="name" />
            </div>
            <div className="pt-field">
              <label htmlFor="profile-email">E-post</label>
              <input id="profile-email" value={ctx.email} readOnly disabled />
              <small>E-posten er den du logger inn med, og kan ikke endres her.</small>
            </div>
          </div>
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="profile-phone">Telefon</label>
              <input id="profile-phone" name="phone" type="tel" maxLength={40} defaultValue={profile?.phone ?? ''} autoComplete="tel" />
            </div>
            <div className="pt-field">
              <label htmlFor="profile-title">Stilling</label>
              <input id="profile-title" name="title" maxLength={120} defaultValue={profile?.title ?? ''} placeholder="F.eks. Skipper" autoComplete="organization-title" />
            </div>
          </div>
          <label className="pt-check">
            <input type="checkbox" name="notify_email" defaultChecked={profile?.notify_email ?? true} />
            <span>Send meg varsler på e-post i tillegg til varslene her på Min side</span>
          </label>
        </PortalForm>
      </Card>

      {ctx.companies.length > 0 && managed.length === 0 && (
        <Card title="Selskap">
          <p className="pt-hint">
            Du er medlem av {ctx.companies.map((company) => `${company.name} (${COMPANY_ROLES[company.role] ?? company.role})`).join(', ')}.
            Bare eiere og administratorer kan endre selskapets opplysninger.
          </p>
        </Card>
      )}

      {(companies ?? []).map((company) => (
        <Card
          key={company.id}
          title={company.name}
          description={company.org_number ? `Org.nr. ${company.org_number}` : 'Organisasjonsnummer er ikke registrert'}
        >
          <PortalForm action={updateCompany} submitLabel="Lagre selskapet" resetOnSuccess={false}>
            <input type="hidden" name="company_id" value={company.id} />
            <div className="pt-field">
              <label htmlFor={`company-name-${company.id}`}>Navn på selskapet</label>
              <input
                id={`company-name-${company.id}`}
                name="name"
                required
                minLength={2}
                maxLength={160}
                defaultValue={company.name}
                readOnly={Boolean(company.verified_at)}
                aria-describedby={company.verified_at ? `company-name-hint-${company.id}` : undefined}
              />
              {company.verified_at && (
                <p id={`company-name-hint-${company.id}`} className="pt-hint">
                  Selskapet er kontrollert av NorthWestCoast. Ta kontakt med oss hvis navnet skal endres.
                </p>
              )}
            </div>
            <div className="pt-field">
              <label htmlFor={`company-address-${company.id}`}>Adresse</label>
              <input id={`company-address-${company.id}`} name="address" maxLength={200} defaultValue={company.address ?? ''} />
            </div>
            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor={`company-postal-${company.id}`}>Postnummer</label>
                <input id={`company-postal-${company.id}`} name="postal_code" inputMode="numeric" maxLength={10} defaultValue={company.postal_code ?? ''} />
              </div>
              <div className="pt-field">
                <label htmlFor={`company-city-${company.id}`}>Poststed</label>
                <input id={`company-city-${company.id}`} name="city" maxLength={80} defaultValue={company.city ?? ''} />
              </div>
            </div>
            <div className="pt-form-row pt-form-row-3">
              <div className="pt-field">
                <label htmlFor={`company-contact-${company.id}`}>Kontaktperson</label>
                <input id={`company-contact-${company.id}`} name="contact_name" maxLength={120} defaultValue={company.contact_name ?? ''} />
              </div>
              <div className="pt-field">
                <label htmlFor={`company-email-${company.id}`}>E-post til kontaktperson</label>
                <input id={`company-email-${company.id}`} name="contact_email" type="email" maxLength={160} defaultValue={company.contact_email ?? ''} />
              </div>
              <div className="pt-field">
                <label htmlFor={`company-phone-${company.id}`}>Telefon</label>
                <input id={`company-phone-${company.id}`} name="contact_phone" type="tel" maxLength={40} defaultValue={company.contact_phone ?? ''} />
              </div>
            </div>
          </PortalForm>
        </Card>
      ))}

      <Card flush>
        <Disclosure summary={ctx.companies.length > 0 ? 'Registrer et selskap til' : 'Registrer et selskap'}>
          <p className="pt-hint" style={{ marginBottom: '0.9rem' }}>
            Du blir eier av selskapet og kan legge til fartøy og invitere kolleger.
          </p>
          <CompanyForm action={createCompany} idPrefix="nytt-selskap" />
        </Disclosure>
      </Card>
    </>
  );
}
