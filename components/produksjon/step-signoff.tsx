'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/portal/forms';

type Action = (formData: FormData) => Promise<ActionResult>;

/**
 * Kvittering av ett produksjonssteg: én stor knapp og et valgfritt notat.
 * Er steget allerede kvittert ut, vises «Angre» i stedet.
 */
export function StepSignoff({
  action,
  stepId,
  done,
}: {
  action: Action;
  stepId: string;
  done: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="pt-inline-form" style={{ display: 'flex' }}>
      <input type="hidden" name="step" value={stepId} />
      <input type="hidden" name="done" value={done ? 'false' : 'true'} />

      {done ? (
        <button type="submit" className="pt-btn pt-btn-ghost pt-btn-sm" disabled={pending}>
          {pending ? 'Angrer…' : 'Angre'}
        </button>
      ) : (
        <>
          <input
            className="pt-input"
            name="note"
            maxLength={1000}
            placeholder="Notat (valgfritt)"
            aria-label="Notat til steget (valgfritt)"
            style={{ flex: '1 1 12rem', width: 'auto' }}
          />
          <button type="submit" className="pt-btn pt-btn-green" disabled={pending}>
            {pending ? 'Kvitterer…' : 'Kvitter ut'}
          </button>
        </>
      )}

      {state && !state.ok && (
        <span className="pt-msg" data-ok="false" role="alert" style={{ flexBasis: '100%' }}>
          {state.error}
        </span>
      )}
    </form>
  );
}
