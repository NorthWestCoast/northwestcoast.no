'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';
import { confirmCode } from '@/app/(portal)/auth/confirm/actions';

const FEIL: Record<string, string> = {
  'manglende-kode': 'Lenken manglet en innloggingskode. Be om en ny nedenfor.',
  'ugyldig-lenke': 'Lenken er brukt opp eller utløpt. Be om en ny nedenfor.',
};

export default function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(FEIL[params.get('feil') ?? ''] ?? null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

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
    setChecking(true);
    try {
      // Lykkes innløsningen, sender serveren oss videre og kallet returnerer aldri.
      const result = await confirmCode(email, code);
      if (result?.error) setCodeError(result.error);
    } finally {
      setChecking(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-card">
        <h2>Sjekk e-posten din</h2>
        <p>
          Vi har sendt en lenke til <strong>{email}</strong>. Klikk på den for
          å logge inn. Har du ikke konto fra før, opprettes den samtidig.
          Lenken virker i 60 minutter.
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
          <button type="submit" className="btn-primary auth-submit" disabled={checking}>
            {checking ? 'Sjekker…' : 'Logg inn med kode'}
          </button>
        </form>

        <p className="auth-hint">
          Koden er nyttig når du leser e-posten på en annen enhet enn den du
          logger inn på. Finner du ikke e-posten? Sjekk søppelpost, eller{' '}
          <button type="button" className="auth-link" onClick={() => setSent(false)}>
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
        Spørsmål? <Link href="/#kontakt">Ta kontakt</Link>.
      </p>
    </form>
  );
}
