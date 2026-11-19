'use client';

import { useActionState, useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/portal/forms';

type Action = (formData: FormData) => Promise<ActionResult>;

/**
 * Skjema knyttet til en server action, med kvittering og feilmelding.
 *
 * Skjemaet sendes med onSubmit, ikke `action={…}`: React tømmer et skjema med
 * action når handlingen er ferdig, også når svaret er en feilmelding, og da
 * ville én valideringsfeil kastet alt brukeren hadde skrevet. Her tømmes
 * feltene bare når lagringen lyktes (slå av med resetOnSuccess={false} for
 * skjema som viser gjeldende verdier).
 */
export function PortalForm({
  action,
  submitLabel,
  pendingLabel = 'Lagrer…',
  tone = 'primary',
  resetOnSuccess = true,
  children,
}: {
  action: Action;
  submitLabel: string;
  pendingLabel?: string;
  tone?: 'primary' | 'green';
  resetOnSuccess?: boolean;
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
      if (result.ok && resetOnSuccess) form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="pt-form">
      {children}
      <div className="pt-form-foot">
        <button type="submit" className={tone === 'green' ? 'pt-btn pt-btn-green' : 'pt-btn'} disabled={pending}>
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

/**
 * Én knapp som utfører en handling (godkjenn, avslå, kvitter ut, slett).
 * `fields` sendes som skjulte felt. Med `confirm` må brukeren bekrefte først.
 */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel = 'Vent…',
  tone = 'ghost',
  size = 'sm',
  confirm,
}: {
  action: Action;
  fields?: Record<string, string>;
  label: string;
  pendingLabel?: string;
  tone?: 'primary' | 'green' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  const toneClass =
    tone === 'green' ? ' pt-btn-green' : tone === 'ghost' ? ' pt-btn-ghost' : tone === 'danger' ? ' pt-btn-danger' : '';

  return (
    <form
      action={formAction}
      className="pt-inline-form"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {fields && Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={`pt-btn${toneClass}${size === 'sm' ? ' pt-btn-sm' : ''}`} disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {state && !state.ok && <span className="pt-msg" data-ok="false" role="alert">{state.error}</span>}
      {state?.ok && <span className="pt-msg" data-ok="true" role="status">{state.message}</span>}
    </form>
  );
}

/** Skrivebeskyttet felt med «Kopier»-knapp, f.eks. en delingslenke. */
export function CopyField({ value, label = 'Kopier' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Utklippstavlen er ikke tilgjengelig (gammel nettleser, ikke https):
      // feltet er uansett markerbart, så brukeren kan kopiere for hånd.
    }
  }

  return (
    <div className="pt-copy">
      <input className="pt-input" readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label="Lenke" />
      <button type="button" className="pt-btn pt-btn-ghost" onClick={copy}>
        {copied ? 'Kopiert' : label}
      </button>
    </div>
  );
}
