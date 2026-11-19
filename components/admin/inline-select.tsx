'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/portal/forms';

/**
 * Nedtrekksliste med «Lagre» på én linje, til endring av én verdi i en
 * tabellrad (rolle, status). `fields` sendes som skjulte felt.
 */
export default function InlineSelect({
  action,
  fields,
  name,
  label,
  options,
  defaultValue,
  submitLabel = 'Lagre',
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  fields?: Record<string, string>;
  name: string;
  /** Leses opp av skjermlesere; vises ikke. */
  label: string;
  options: Record<string, string>;
  defaultValue: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="pt-inline-form">
      {fields && Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <select name={name} defaultValue={defaultValue} aria-label={label} className="pt-input" style={{ width: 'auto' }}>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
      <button type="submit" className="pt-btn pt-btn-ghost pt-btn-sm" disabled={pending}>
        {pending ? 'Lagrer…' : submitLabel}
      </button>
      {state && (
        <span className="pt-msg" data-ok={state.ok} role={state.ok ? 'status' : 'alert'}>
          {state.ok ? state.message : state.error}
        </span>
      )}
    </form>
  );
}
