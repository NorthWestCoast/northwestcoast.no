'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';
import { LOGIN_VALID_MINUTES, siteHref } from '@/lib/site';
import { confirmCode } from '@/app/(portal)/auth/confirm/actions';

const FEIL: Record<string, string> = {
  'manglende-kode': 'Lenken manglet en innloggingskode. Be om en ny nedenfor.',
  'ugyldig-lenke': 'Lenken er brukt opp eller utløpt. Be om en ny nedenfor.',
};

/**
 * Adressen det er bedt om lenke for, husket i fanen. Brukes bare til å vise
 * kodefeltet igjen når siden lastes på nytt, så koden kan skrives inn uten å
 * be om en ny e-post. Husker ikke lenger enn koden virker.
 */
const SENT_KEY = 'nwc_innlogging_sendt';
const SENT_TTL_MS = LOGIN_VALID_MINUTES * 60 * 1000;

function rememberSent(email: string | null) {
  try {
    if (email) sessionStorage.setItem(SENT_KEY, JSON.stringify({ email, at: Date.now() }));
    else sessionStorage.removeItem(SENT_KEY);
  } catch {
    // Lagring kan være slått av i nettleseren. Da husker vi ingenting.
  }
}

function sentBeforeReload(): string | null {
  try {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entry?.type !== 'reload') return null;
    const saved = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? 'null');
    const fresh = typeof saved?.email === 'string' && Date.now() - Number(saved.at) < SENT_TTL_MS;
    return fresh ? saved.email : null;
  } catch {
    return null;
  }
}

export default function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(FEIL[params.get('feil') ?? ''] ?? null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);

  // Etter en omlasting: vis kodefeltet igjen for adressen det nettopp ble bedt om lenke for.
  useEffect(() => {
    const address = sentBeforeReload();
    if (!address) return;
    setEmail(address);
    setSent(true);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      // `neste` tas vare på gjennom hele flyten, så brukeren lander der hun
      // egentlig skulle etter å ha klikket lenka i e-posten.
      const neste = params.get('neste') ?? '/minside';
      const redirectTo = `${window.location.origin}/auth/callback?neste=${encodeURIComponent(neste)}`;
      // Lenken i e-posten går til /auth/confirm og bærer ikke `neste` med seg
      // (den skal også virke på en annen enhet). Åpnes den i denne
      // nettleseren, finner bekreftelsessiden målet her.
      document.cookie = `nwc_neste=${encodeURIComponent(neste)}; path=/; max-age=3600; samesite=lax`;

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (authError) throw new Error(authError.message);

      track('Auth: Magic link requested');
      rememberSent(email);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Vi klarte ikke å sende lenken: ${err.message}`
          : 'Vi klarte ikke å sende lenken. Prøv igjen.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCodeError(null);
    setOutdated(false);
    setChecking(true);
    try {
      const result = await confirmCode(email, code);
      if ('next' in result) {
        rememberSent(null);
        // Full sidelasting, ikke en overgang inne i siden: se confirmCode.
        // Knappen blir stående som «Sjekker…» til den nye siden er på plass.
        window.location.assign(result.next);
        return;
      }
      setCodeError(result.error);
    } catch {
      // Kallet nådde ikke fram til funksjonen på serveren. Det skjer når
      // siden er eldre enn serveren, eller når nettet faller ut.
      setOutdated(true);
    }
    setChecking(false);
  }

  if (sent) {
    return (
      <div className="auth-card">
        <h2>Sjekk e-posten din</h2>
        <p>
          Vi har sendt en lenke til <strong>{email}</strong>. Klikk på den for
          å logge inn. Har du ikke konto fra før, opprettes den samtidig.
          Lenken virker i {LOGIN_VALID_MINUTES} minutter.
        </p>

        <form onSubmit={handleCode} style={{ marginTop: '1.25rem' }}>
          <div className="fg">
            <label htmlFor="login-code">Eller skriv inn koden fra e-posten</label>
            <input
              id="login-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,12}"
              maxLength={12}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
          {codeError && <p className="config-error">{codeError}</p>}
          {outdated && (
            <p className="config-error">
              Vi fikk ikke sjekket koden. Siden kan være oppdatert siden du åpnet den.{' '}
              <button type="button" className="auth-link" onClick={() => window.location.reload()}>
                Last siden på nytt
              </button>{' '}
              og skriv inn koden igjen.
            </p>
          )}
          <button type="submit" className="btn-primary auth-submit" disabled={checking}>
            {checking ? 'Sjekker…' : 'Logg inn med kode'}
          </button>
        </form>

        <p className="auth-hint">
          Koden er nyttig når du leser e-posten på en annen enhet enn den du
          logger inn på. Finner du ikke e-posten? Sjekk søppelpost, eller{' '}
          <button type="button" className="auth-link" onClick={() => { rememberSent(null); setSent(false); }}>
            prøv en annen adresse
          </button>.
        </p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <div className="fg">
        <label htmlFor="login-email">E-post</label>
        <input
          id="login-email"
          name="email"
          type="email"
          placeholder="din@rederi.no"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      {error && <p className="config-error">{error}</p>}

      <button type="submit" className="btn-primary auth-submit" disabled={loading}>
        {loading ? 'Sender…' : 'Send lenke på e-post →'}
      </button>

      <p className="auth-hint">
        Samme skjema for innlogging og ny konto: er adressen ny, får du en
        konto automatisk med den første lenken.
      </p>
      <p className="auth-hint">
        Alle kan opprette konto. På Min side registrerer du selskapet ditt og
        legger til leiderne dine med produksjonsnummeret som står på leideren.
        Spørsmål? <Link href={siteHref('/#kontakt')}>Ta kontakt</Link>.
      </p>
    </form>
  );
}
