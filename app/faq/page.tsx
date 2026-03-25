'use client';

import { useState } from 'react';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { FAQS } from '@/components/faq';

const CATEGORIES = ['Alle', 'Produkt', 'Sertifisering', 'Montering', 'Leveranse'];

export default function FaqPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Alle');
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
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Hjelp &amp; Support</div>
        <h1>Ofte stilte spørsmål</h1>
        <p>Finn svar på de vanligste spørsmålene om Argostep.</p>
      </div>

      <section className="faq-full">
        <div className="faq-full-controls">
          <input
            className="faq-search"
            type="search"
            placeholder="Søk i spørsmål og svar…"
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
                  {faq.q}
                  <span className="fi-icon">+</span>
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
                <label>Navn *</label>
                <input name="name" type="text" placeholder="Ditt navn" required />
              </div>
              <div className="fg">
                <label>E-post *</label>
                <input name="email" type="email" placeholder="epost@firma.no" required />
              </div>
            </div>
            <div className="fg">
              <label>Spørsmål *</label>
              <textarea name="message" placeholder="Hva lurer du på?" required />
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

      <Footer />
    </>
  );
}
