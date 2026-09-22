import type { ServiceState } from '@/lib/supabase/database.types';
import { fristTekst } from '@/lib/format';

const LABEL: Record<ServiceState, string> = {
  overdue: 'Forfalt',
  due_soon: 'Snart',
  ok: 'OK',
  unknown: 'Ukjent',
};

/**
 * Servicestatus.
 *
 * «Ukjent» er en egen tilstand med vilje: en leider uten installasjonsdato
 * har ingen beregnet frist. Å vise den som OK ville skjult at noe mangler.
 */
export default function ServiceBadge({
  state,
  days,
}: {
  state: ServiceState | null;
  days?: number | null;
}) {
  const value: ServiceState = state ?? 'unknown';

  return (
    <span className={`ms-badge ms-badge-${value}`}>
      {LABEL[value]}
      {value !== 'unknown' && days !== undefined && days !== null && (
        <span className="ms-badge-sub">{fristTekst(days)}</span>
      )}
    </span>
  );
}
