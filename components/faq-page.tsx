'use client';

import { useState } from 'react';
import { answerParagraphs, type FaqCategory, type FaqEntry } from '@/lib/faq';
import { useLang, useT } from '@/components/lang-provider';
import { track } from '@/lib/analytics';

const CATEGORIES: (FaqCategory | 'all')[] = [
  'all',
  'product',
  'certification',
  'installation',
  'delivery',
];

/** Alle publiserte spørsmål (lib/faq.ts), med søk og kategorier. */
export default function FaqPageContent({ items }: { items: FaqEntry[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = useLang();
  const t = useT();

  const filtered = items.filter((item) => {
    const matchCat = category === 'all' || item.category === category;
    const q = search.toLowerCase();
    const matchSearch =
      !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, lang, product: 'FAQ-spørsmål' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.errors.generic);
      }
      track('Lead: Contact form', { props: { product: 'FAQ-spørsmål' } });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="faq-full">
        <div className="faq-full-controls">
          <input
            className="faq-search"
            type="search"
            placeholder={t.faq.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="gallery-tabs" style={{ margin: 0 }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`tab${category === cat ? ' active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {t.faq.categories[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="faq-full-list">
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              {t.faq.noMatch}
            </p>
          ) : (
            filtered.map((item) => (
              <details className="fi" key={item.id}>
                <summary className="fq">
                  {item.q}
                  <span className="fi-icon">+</span>
                </summary>
                {answerParagraphs(item.a).map((part, index) => (
                  <p className="fa" key={index}>{part}</p>
                ))}
              </details>
            ))
          )}
        </div>
      </section>

      <section className="faq-contact">
        <div className="faq-contact-inner">
          <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.faq.contactLabel}</div>
          <h2 className="stitle" style={{ textAlign: 'center', color: '#fff' }}>
            {t.faq.contactHeading}
          </h2>
          <p className="sub" style={{ textAlign: 'center', margin: '0.75rem auto 2.5rem' }}>
            {t.faq.contactSub}
          </p>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="fg">
                <label>{t.contact.form.name}</label>
                <input name="name" type="text" placeholder={t.contact.form.namePlaceholder} required />
              </div>
              <div className="fg">
                <label>{t.contact.form.email}</label>
                <input name="email" type="email" placeholder={t.contact.form.emailPlaceholder} required />
              </div>
            </div>
            <div className="fg">
              <label>{t.faq.questionLabel}</label>
              <textarea name="message" placeholder={t.faq.questionPlaceholder} required />
            </div>

            {/* Honeypot – skjult for mennesker, fylles ut av bots */}
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hp-field"
            />

            {error && <p className="config-error">{error}</p>}

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
                {loading ? t.contact.form.sending : t.faq.submit}
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
                {t.contact.form.success}
              </div>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
