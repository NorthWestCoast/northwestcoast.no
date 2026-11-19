'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/portal/forms';

/**
 * Avkrysningen «Gjelder også skap» i lista over steg. Lagrer med en gang den
 * endres, og går tilbake hvis lagringen feiler.
 */
export function CabinetToggle({
  action,
  stepId,
  title,
  checked,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  stepId: string;
  title: string;
  checked: boolean;
}) {
  const [value, setValue] = useState(checked);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setValue(next);
    setError(null);

    const formData = new FormData();
    formData.set('step_id', stepId);
    formData.set('for_cabinet', next ? 'true' : 'false');

    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setValue(!next);
        setError(result.error);
      }
    });
  }

  return (
    <span>
      <label className="pt-check">
        <input
          type="checkbox"
          checked={value}
          disabled={pending}
          onChange={(event) => change(event.target.checked)}
          aria-label={`«${title}» gjelder også skap`}
        />
        <span className="pt-muted">{value ? 'Ja' : 'Nei'}</span>
      </label>
      {error && <span className="pt-msg" data-ok="false" role="alert">{error}</span>}
    </span>
  );
}
