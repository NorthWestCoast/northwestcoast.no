import { fristTekst } from '@/lib/format';

export type ServiceState = 'ok' | 'due_soon' | 'overdue' | 'unknown';

const LABEL: Record<ServiceState, string> = {
  overdue: 'Forfalt',
  due_soon: 'Snart',
  ok: 'OK',
  unknown: 'Ukjent',
};

/** Viewet ladder_status leverer service_state som ren tekst. */
function toServiceState(value: string | null | undefined): ServiceState {
  return value && Object.hasOwn(LABEL, value) ? (value as ServiceState) : 'unknown';
}

/**
 * Servicestatus.
 *
 * «Ukjent» er en egen tilstand med vilje: en leider uten installasjonsdato
 * har ingen beregnet frist. Å vise den som OK ville skjult at noe mangler.
 * Verdier vi ikke kjenner igjen havner også her, i stedet for å vises som OK.
 */
export default function ServiceBadge({
  state,
  days,
}: {
  state: string | null;
  days?: number | null;
}) {
  const value = toServiceState(state);

  return (
    <span className={`ms-badge ms-badge-${value}`}>
      {LABEL[value]}
      {value !== 'unknown' && days !== undefined && days !== null && (
        <span className="ms-badge-sub">{fristTekst(days)}</span>
      )}
    </span>
  );
}
