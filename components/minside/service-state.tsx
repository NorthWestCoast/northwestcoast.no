import { Badge } from '@/components/portal/ui';
import { serviceState } from '@/lib/portal/labels';
import { dato, fristTekst } from '@/lib/format';

/**
 * Servicestatus for en leider.
 *
 * «Ingen frist» er en egen tilstand med vilje: en leider som ikke er montert
 * har ingen beregnet frist, og skal ikke se ut som om alt er i orden.
 * Med `due` vises fristen ved siden av merket.
 */
export default function ServiceState({
  state,
  due,
  days,
}: {
  state: string | null | undefined;
  due?: string | null;
  days?: number | null;
}) {
  const { label, tone } = serviceState(state ?? 'unknown');
  const known = state === 'ok' || state === 'due_soon' || state === 'overdue';

  return (
    <>
      <Badge tone={tone}>{label}</Badge>
      {known && due && (
        <span className="pt-hint">
          {' '}{dato(due)}{days !== null && days !== undefined ? ` (${fristTekst(days)})` : ''}
        </span>
      )}
    </>
  );
}
