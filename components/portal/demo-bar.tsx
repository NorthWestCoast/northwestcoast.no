'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEMO_BLOCKED_PARAM, DEMO_BLOCKED_VALUE, DEMO_STOP } from '@/lib/portal/demo';

const NOTE = 'Alt du ser her er fiktive data, og ingenting kan endres.';

/** Byttes ut når middleware har stoppet et skjema (?demo=lest). */
function Message() {
  const blocked = useSearchParams().get(DEMO_BLOCKED_PARAM) === DEMO_BLOCKED_VALUE;
  if (blocked) {
    return <strong>Ikke lagret. Demovisningen er bare til å se på.</strong>;
  }
  return <>{NOTE}</>;
}

/**
 * Stripa som står fast øverst så lenge demovisningen er på (lib/portal/demo.ts).
 * Den skal ikke kunne overses: gul, over alt annet, på hver side.
 */
export default function DemoBar() {
  return (
    <div className="pt-demo" role="status">
      <span className="pt-demo-tag">Demo</span>
      <p className="pt-demo-text">
        <span className="pt-demo-title">Demovisning</span>
        <span className="pt-demo-note">
          <Suspense fallback={NOTE}>
            <Message />
          </Suspense>
        </span>
      </p>
      <form action={DEMO_STOP} method="post">
        <button type="submit" className="pt-demo-stop">Avslutt demo</button>
      </form>
    </div>
  );
}
