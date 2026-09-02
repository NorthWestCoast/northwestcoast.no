'use client';

import { useState } from 'react';
import { FAQS, FAQ_CATEGORIES } from '@/lib/faqs';

/**
 * The interactive part of /faq (search + category filter + contact form).
 *
 * Split out of the page so app/faq/page.tsx can stay a server component and
 * export metadata and FAQPage JSON-LD — a client page cannot do either.
 *
 * All questions and answers are rendered into the initial HTML (the filter only
 * hides them client-side), so a crawler that does not run JavaScript still sees
 * every answer. That is deliberate: FAQ text is the single most quotable content
 * on the site for an answer engine.
 */
export default function FaqSearch() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('Alle');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const filtered = FAQS.filter((faq) => {
    const matchCat = category === 'Alle' || faq.category === category;
    const q = search.toLowerCase();
    const matchSearch = !q || faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch { /* fail silently */ }
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <>
      <section className="faq-full">
        <div className="faq-full-controls">
          <label className="sr-only" htmlFor="faq-search">Søk i spørsmål og svar</label>
          <input
            id="faq-search"
            className="faq-search"
            type="search"
            placeholder="Søk i spørsmål og svar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="gallery-tabs" style={{ margin: 0 }}>
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`tab${category === cat ? ' active' : ''}`}
                aria-pressed={category === cat}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="faq-full-list">
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              Ingen spørsmål matcher søket ditt.
            </p>
          ) : (
            filtered.map((faq) => (
              <details className="fi" key={faq.q}>
                <summary className="fq">
                  <h2 className="fq-title">{faq.q}</h2>
                  <span className="fi-icon" aria-hidden="true">+</span>
                </summary>
                <p className="fa">{faq.a}</p>
              </details>
            ))
          )}
        </div>
      </section>

      <section className="faq-contact">
        <div className="faq-contact-inner">
          <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Kontakt</div>
          <h2 className="stitle" style={{ textAlign: 'center', color: '#fff' }}>
            Ikke funnet svaret?
          </h2>
          <p className="sub" style={{ textAlign: 'center', margin: '0.75rem auto 2.5rem' }}>
            Kontakt oss direkte – vi hjelper gjerne.
          </p>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="fg">
                <label htmlFor="faq-name">Navn *</label>
                <input id="faq-name" name="name" type="text" placeholder="Ditt navn" required />
              </div>
              <div className="fg">
                <label htmlFor="faq-email">E-post *</label>
                <input id="faq-email" name="email" type="email" placeholder="epost@firma.no" required />
              </div>
            </div>
            <div className="fg">
              <label htmlFor="faq-message">Spørsmål *</label>
              <textarea id="faq-message" name="message" placeholder="Hva lurer du på?" required />
            </div>

            {!submitted ? (
              <button
                type="submit"
                className="btn-primary"
                style={{
                  border: 'none',
                  cursor: loading ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: '0.95rem',
                  opacity: loading ? 0.7 : 1,
                }}
                disabled={loading}
              >
                {loading ? 'Sender…' : 'Send spørsmål →'}
              </button>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '1rem',
                background: 'rgba(46,204,113,0.12)',
                borderRadius: '0.75rem',
                border: '1px solid var(--green)',
                color: 'var(--green)',
                fontWeight: 600,
              }}>
                ✓ Takk! Vi tar kontakt snart.
              </div>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
