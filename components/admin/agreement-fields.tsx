import { Input, Select, Textarea } from './fields';
import { idag } from '@/lib/format';
import type { Tone } from '@/lib/portal/labels';
import type { Tables } from '@/lib/supabase/database.types';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Utkast', tone: 'neutral' },
  active: { label: 'Aktiv', tone: 'ok' },
  expired: { label: 'Utløpt', tone: 'warn' },
  cancelled: { label: 'Avsluttet', tone: 'neutral' },
};

/** Norsk navn og fargetone for statusen på en serviceavtale. */
export const agreementStatus = (status: string) => STATUS[status] ?? { label: status, tone: 'neutral' as Tone };

type Agreement = Pick<
  Tables<'service_agreements'>,
  'title' | 'starts_on' | 'ends_on' | 'interval_months' | 'price_nok' | 'covers' | 'notes' | 'status'
>;

/** Feltene i en serviceavtale. Brukes både for ny avtale og redigering. */
export default function AgreementFields({ scope, agreement }: { scope: string; agreement?: Agreement }) {
  return (
    <>
      <div className="pt-form-row">
        <Input scope={scope} name="title" label="Tittel" maxLength={160} defaultValue={agreement?.title ?? 'Serviceavtale'} />
        <Select scope={scope} name="status" label="Status" defaultValue={agreement?.status ?? 'active'}>
          {Object.entries(STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>
      <div className="pt-form-row">
        <Input scope={scope} name="starts_on" label="Start" type="date" required defaultValue={agreement?.starts_on ?? idag()} />
        <Input scope={scope} name="ends_on" label="Slutt" type="date" defaultValue={agreement?.ends_on ?? ''} hint="Tom: løpende avtale." />
      </div>
      <div className="pt-form-row">
        <Input
          scope={scope}
          name="interval_months"
          label="Intervall (måneder)"
          type="number"
          min={1}
          max={120}
          required
          inputMode="numeric"
          defaultValue={agreement?.interval_months ?? 12}
        />
        <Input
          scope={scope}
          name="price_nok"
          label="Pris, kr eks. mva"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          defaultValue={agreement?.price_nok ?? ''}
        />
      </div>
      <Textarea
        scope={scope}
        name="covers"
        label="Omfang"
        rows={3}
        maxLength={2000}
        defaultValue={agreement?.covers ?? ''}
        placeholder="Hva avtalen dekker."
      />
      <Textarea scope={scope} name="notes" label="Notat" rows={2} maxLength={2000} defaultValue={agreement?.notes ?? ''} />
    </>
  );
}
