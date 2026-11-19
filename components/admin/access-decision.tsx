'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/portal/forms';
import { LADDER_ROLES } from '@/lib/portal/labels';

/**
 * Godkjenn eller avslå en tilgangsforespørsel. Ett skjema med to knapper:
 * knappen som trykkes sender `decision` = approve / reject.
 */
export default function AccessDecision({
  action,
  requestId,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  requestId: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="pt-form">
      <input type="hidden" name="request_id" value={requestId} />
      <div className="pt-form-row">
        <div className="pt-field">
          <label htmlFor={`${requestId}-role`}>Tilgang ved godkjenning</label>
          <select id={`${requestId}-role`} name="role" defaultValue="viewer">
            {Object.entries(LADDER_ROLES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="pt-field">
          <label htmlFor={`${requestId}-note`}>Melding til den som spør (valgfritt)</label>
          <input id={`${requestId}-note`} name="note" maxLength={300} />
        </div>
      </div>
      <div className="pt-form-foot">
        <button type="submit" name="decision" value="approve" className="pt-btn pt-btn-green" disabled={pending}>
          Godkjenn
        </button>
        <button type="submit" name="decision" value="reject" className="pt-btn pt-btn-danger" disabled={pending}>
          Avslå
        </button>
        {state && (
          <span className="pt-msg" data-ok={state.ok} role={state.ok ? 'status' : 'alert'}>
            {state.ok ? state.message : state.error}
          </span>
        )}
      </div>
    </form>
  );
}
