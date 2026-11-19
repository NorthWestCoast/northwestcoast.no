'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/portal/forms';

/**
 * Skjema som beholder det brukeren har skrevet, også når lagringen avvises.
 *
 * Et skjema med `action={…}` tømmes av React når handlingen er ferdig, selv
 * om svaret er en feilmelding. For lange skjema (prislista, et nyhetsinnlegg)
 * ville én valideringsfeil kastet alt arbeidet. Her sendes skjemaet derfor
 * med onSubmit, og feltene står urørt etterpå. Samme utseende som PortalForm.
 */
export default function KeepForm({
  action,
  submitLabel,
  pendingLabel = 'Lagrer…',
  uncheckOnSuccess,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  pendingLabel?: string;
  /** Navn på en avkrysningsboks som skal nullstilles etter lagring (en bekreftelse). */
  uncheckOnSuccess?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      // Sender handlingen brukeren videre (redirect), kommer det ikke noe svar.
      const result = await action(formData);
      if (!result) return;
      setState(result);
      if (result.ok && uncheckOnSuccess) {
        const box = form.elements.namedItem(uncheckOnSuccess);
        if (box instanceof HTMLInputElement) box.checked = false;
      }
    });
  }

  return (
    <form onSubmit={submit} className="pt-form">
      {children}
      <div className="pt-form-foot">
        <button type="submit" className="pt-btn" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
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
