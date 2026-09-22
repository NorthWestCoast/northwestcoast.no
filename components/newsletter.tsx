'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';

export default function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;

    setError(null);
    setLoading(true);

    const honeypot = new FormData(e.currentTarget).get('company_website');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company_website: honeypot }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Vi klarte ikke å registrere deg. Prøv igjen.');
      }

      track('Lead: Newsletter');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vi klarte ikke å registrere deg. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nl">
      <div className="lbl" style={{ justifyContent: 'center', marginBottom: '0.8rem' }}>Nyhetsbrev</div>
      <h2>Registrer deg for å motta nyhetsbrev</h2>
      <p>Siste nyheter om maritim sikkerhet, Argostep og norske sjøfartsforskrifter.</p>

      {submitted ? (
        <p style={{ color: 'var(--green)', fontWeight: 600, marginTop: '1.5rem' }}>
          ✓ Du er registrert!
        </p>
      ) : (
        <form className="nl-form" onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Din e-postadresse..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {/* Honeypot – skjult for mennesker, fylles ut av bots */}
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hp-field"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sender…' : 'Registrer'}
          </button>
        </form>
      )}

      {error && <p className="nl-error">{error}</p>}
    </div>
  );
}
