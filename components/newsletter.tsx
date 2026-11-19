'use client';

import { useState } from 'react';
import { useLang, useT } from '@/components/lang-provider';
import { track } from '@/lib/analytics';

export default function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const lang = useLang();
  const t = useT();

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
        body: JSON.stringify({ email, lang, company_website: honeypot }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.errors.generic);
      }
      track('Lead: Newsletter');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nl">
      <div className="lbl" style={{ justifyContent: 'center', marginBottom: '0.8rem' }}>
        {t.newsletter.label}
      </div>
      <h2>{t.newsletter.title}</h2>
      <p>{t.newsletter.sub}</p>

      {submitted ? (
        <p style={{ color: 'var(--green)', fontWeight: 600, marginTop: '1.5rem' }}>
          {t.newsletter.success}
        </p>
      ) : (
        <>
          <form className="nl-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder={t.newsletter.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hp-field"
            />
            <button type="submit" disabled={loading}>
              {loading ? t.newsletter.sending : t.newsletter.submit}
            </button>
          </form>
          {error && <p className="nl-error">{error}</p>}
        </>
      )}
    </div>
  );
}
