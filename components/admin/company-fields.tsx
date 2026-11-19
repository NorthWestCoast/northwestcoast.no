import CompanyLookup, { type KnownCompany } from '@/components/portal/company-lookup';
import { Input } from './fields';
import type { Tables } from '@/lib/supabase/database.types';

type Company = Pick<
  Tables<'companies'>,
  'name' | 'org_number' | 'address' | 'postal_code' | 'city' | 'contact_name' | 'contact_email' | 'contact_phone'
>;

/** Oppslaget over feltene: Brønnøysundregistrene, og eventuelt «Finn kunde via fartøy». */
type Lookup = {
  /** Kundene som finnes fra før, til kontroll mot dubletter. */
  known: KnownCompany[];
  /** Selskapet som redigeres. */
  selfId?: string;
  /** Feltnavn-prefiks for fartøyet i samme skjema. Slår på søk via fartøy. */
  vesselPrefix?: string;
  label?: string;
  hint?: string;
};

/**
 * Feltene for et selskap. Brukes både ved opprettelse og redigering. Med
 * `lookup` står et søk i Brønnøysundregistrene over feltene; et valgt treff
 * fyller dem ut, og alt kan rettes eller fylles ut for hånd.
 */
export default function CompanyFields({
  scope,
  company,
  lookup,
}: {
  scope: string;
  company?: Company;
  lookup?: Lookup;
}) {
  return (
    <>
      {lookup && (
        <CompanyLookup
          id={`${scope}-brreg`}
          known={lookup.known}
          selfId={lookup.selfId}
          vesselPrefix={lookup.vesselPrefix}
          label={lookup.label}
          hint={lookup.hint}
        />
      )}
      <div className="pt-form-row">
        <Input scope={scope} name="name" label="Navn" required maxLength={160} defaultValue={company?.name ?? ''} placeholder="Rederi AS" />
        <Input
          scope={scope}
          name="org_number"
          label="Org.nr."
          inputMode="numeric"
          maxLength={20}
          defaultValue={company?.org_number ?? ''}
          placeholder="998 196 159"
          hint="Kontrollsifferet sjekkes, så tastefeil avvises."
        />
      </div>
      <div className="pt-form-row pt-form-row-3">
        <Input scope={scope} name="address" label="Adresse" maxLength={200} defaultValue={company?.address ?? ''} />
        <Input scope={scope} name="postal_code" label="Postnr." inputMode="numeric" maxLength={10} defaultValue={company?.postal_code ?? ''} />
        <Input scope={scope} name="city" label="Sted" maxLength={80} defaultValue={company?.city ?? ''} />
      </div>
      <div className="pt-form-row pt-form-row-3">
        <Input scope={scope} name="contact_name" label="Kontaktperson" maxLength={120} defaultValue={company?.contact_name ?? ''} />
        <Input scope={scope} name="contact_email" label="E-post" type="email" maxLength={160} defaultValue={company?.contact_email ?? ''} />
        <Input scope={scope} name="contact_phone" label="Telefon" type="tel" maxLength={40} defaultValue={company?.contact_phone ?? ''} />
      </div>
    </>
  );
}
