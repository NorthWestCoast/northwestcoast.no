'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/app/admin/actions';

/**
 * Skjema knyttet til en server action, med tilbakemelding.
 *
 * useActionState holder resultatet fra forrige innsending, slik at vi kan
 * vise både feil og kvittering uten egen state-håndtering per skjema.
 */
export default function ActionForm({
  action,
  submitLabel,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="adm-form">
      {children}

      {state && (
        <p className={state.ok ? 'adm-ok' : 'adm-error'}>
          {state.ok ? `✓ ${state.message}` : `✕ ${state.error}`}
        </p>
      )}

      <button type="submit" className="adm-submit" disabled={pending}>
        {pending ? 'Lagrer…' : submitLabel}
      </button>
    </form>
  );
}
