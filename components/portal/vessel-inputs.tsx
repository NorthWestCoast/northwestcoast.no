import type { Tables } from '@/lib/supabase/database.types';
import { decimalText } from './registry-fill';

export type VesselDefaults = Partial<
  Pick<
    Tables<'vessels'>,
    | 'name' | 'imo' | 'call_sign' | 'registration_mark' | 'vessel_type' | 'home_port'
    | 'length_m' | 'beam_m' | 'build_year' | 'registry_id'
  >
>;

/**
 * Feltene for et fartøy. Brukes i alle skjemaene for nytt og endret fartøy,
 * både på Min side og i admin. Leses på serveren med readVessel() i
 * vessel-values.ts (samme `prefix`).
 *
 * `scope` gjør id-ene unike når flere skjema står på samme side. `prefix`
 * settes foran feltnavnene der fartøyet står i samme skjema som et selskap.
 */
export default function VesselInputs({
  scope,
  prefix = '',
  vessel,
  nameRequired = true,
}: {
  scope: string;
  prefix?: string;
  vessel?: VesselDefaults;
  nameRequired?: boolean;
}) {
  const id = (name: string) => `${scope}-${name}`;
  const name = (field: string) => `${prefix}${field}`;

  return (
    <>
      {/* Id-en i fartøyregisteret. Et tekstfelt som er skjult, ikke type="hidden":
          da tilbakestilles det sammen med resten av skjemaet, og verdien som
          fylles inn fra søket overlever at siden tegnes på nytt. */}
      <input
        type="text"
        name={name('registry_id')}
        defaultValue={vessel?.registry_id ?? ''}
        maxLength={60}
        hidden
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="pt-form-row pt-form-row-3">
        <div className="pt-field">
          <label htmlFor={id('name')}>Navn</label>
          <input
            id={id('name')}
            name={name('name')}
            required={nameRequired}
            minLength={2}
            maxLength={160}
            defaultValue={vessel?.name ?? ''}
            placeholder="F.eks. MS Nordlys"
          />
        </div>
        <div className="pt-field">
          <label htmlFor={id('type')}>Type</label>
          <input
            id={id('type')}
            name={name('vessel_type')}
            maxLength={80}
            defaultValue={vessel?.vessel_type ?? ''}
            placeholder="F.eks. Fiskefartøy"
          />
        </div>
        <div className="pt-field">
          <label htmlFor={id('port')}>Hjemmehavn</label>
          <input id={id('port')} name={name('home_port')} maxLength={80} defaultValue={vessel?.home_port ?? ''} />
        </div>
      </div>
      <div className="pt-form-row pt-form-row-3">
        <div className="pt-field">
          <label htmlFor={id('imo')}>IMO-nummer</label>
          <input
            id={id('imo')}
            name={name('imo')}
            inputMode="numeric"
            maxLength={11}
            defaultValue={vessel?.imo ?? ''}
            placeholder="7 siffer"
          />
        </div>
        <div className="pt-field">
          <label htmlFor={id('call')}>Kallesignal</label>
          <input
            id={id('call')}
            name={name('call_sign')}
            maxLength={20}
            defaultValue={vessel?.call_sign ?? ''}
            autoCapitalize="characters"
          />
        </div>
        <div className="pt-field">
          <label htmlFor={id('mark')}>Registreringsmerke</label>
          <input
            id={id('mark')}
            name={name('registration_mark')}
            maxLength={20}
            defaultValue={vessel?.registration_mark ?? ''}
            autoCapitalize="characters"
            placeholder="F.eks. M-12-HØ"
          />
        </div>
      </div>
      <div className="pt-form-row pt-form-row-3">
        <div className="pt-field">
          <label htmlFor={id('length')}>Lengde (m)</label>
          <input
            id={id('length')}
            name={name('length_m')}
            inputMode="decimal"
            maxLength={8}
            defaultValue={decimalText(vessel?.length_m) ?? ''}
          />
        </div>
        <div className="pt-field">
          <label htmlFor={id('beam')}>Bredde (m)</label>
          <input
            id={id('beam')}
            name={name('beam_m')}
            inputMode="decimal"
            maxLength={8}
            defaultValue={decimalText(vessel?.beam_m) ?? ''}
          />
        </div>
        <div className="pt-field">
          <label htmlFor={id('year')}>Byggeår</label>
          <input
            id={id('year')}
            name={name('build_year')}
            inputMode="numeric"
            maxLength={4}
            defaultValue={vessel?.build_year ?? ''}
          />
        </div>
      </div>
    </>
  );
}
