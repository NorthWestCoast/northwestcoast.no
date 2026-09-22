'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';

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

  if (sent) {
    return (
      <div className="auth-card">
        <div className="auth-success-icon" aria-hidden="true">✉️</div>
        <h2>Sjekk e-posten din</h2>
        <p>
          Vi har sendt en innloggingslenke til <strong>{email}</strong>.
          Lenken virker i 60 minutter.
        </p>
        <p className="auth-hint">
          Finner du den ikke? Sjekk søppelpost, eller{' '}
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
        {loading ? 'Sender…' : 'Send innloggingslenke →'}
      </button>

      <p className="auth-hint">
        Min side er for kunder med registrerte Argostep-leidere. Har du ikke
        tilgang? <Link href="/#kontakt">Ta kontakt</Link>.
      </p>
    </form>
  );
}
