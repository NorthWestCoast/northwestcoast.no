'use client';

import { useState, useTransition } from 'react';
import { revokeCertificate } from '@/app/(portal)/admin/service/actions';
import type { ActionResult } from '@/lib/portal/forms';

/**
 * Trekker et servicesertifikat tilbake. Krever en begrunnelse, og spør én
 * gang til før det skjer: tilbaketrekkingen kan ikke angres.
 */
export default function RevokeCertificate({ certificateId, number }: { certificateId: string; number: string }) {
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sure = window.confirm(
      `Trekke tilbake ${number}? Det kan ikke angres. Kontrollsiden vil vise at det ikke lenger gjelder.`,
    );
    if (!sure) return;

    startTransition(async () => {
      setState(await revokeCertificate(formData));
    });
  }

  return (
    <details className="pt-more">
      <summary>Trekk tilbake</summary>
      <form onSubmit={submit} className="pt-form">
        <input type="hidden" name="certificate_id" value={certificateId} />
        <div className="pt-field">
          <label htmlFor={`revoke-${certificateId}`}>Begrunnelse</label>
          <textarea id={`revoke-${certificateId}`} name="reason" rows={2} required minLength={3} maxLength={500} />
          <small>Kunden ser begrunnelsen. Tilbaketrekkingen kan ikke angres.</small>
        </div>
        <div className="pt-form-foot">
          <button type="submit" className="pt-btn pt-btn-danger pt-btn-sm" disabled={pending}>
            {pending ? 'Vent…' : 'Trekk tilbake'}
          </button>
          {state && (
            <span className="pt-msg" data-ok={state.ok} role={state.ok ? 'status' : 'alert'}>
              {state.ok ? state.message : state.error}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}
