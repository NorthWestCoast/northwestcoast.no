'use client';

import { useEffect, useRef, useState } from 'react';

const TEAM = [
  { initials: '👤', name: 'Kristian B. Dyb', email: 'kristian@astep.no' },
  { initials: '👤', name: 'Arve Toven',      email: 'arve@astep.no' },
  { initials: '👤', name: 'Tor Arne Reitan', email: 'tor@astep.no' },
];

export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // fail silently – show success regardless for UX
    }

    setLoading(false);
    setSubmitted(true);
  }

  return (
    <section className="contact" id="kontakt" ref={sectionRef}>
      <div className="contact-grid">
        {/* Contact info */}
        <div className="reveal">
          <div className="lbl">Kontakt oss</div>
          <h2 className="stitle">Ta Kontakt</h2>
          <p className="sub" style={{ marginBottom: '0.5rem' }}>
            Be om tilbud tilpasset ditt fartøy – vi svarer raskt.
          </p>
          <div className="contact-info">
            <div className="ci">
              <div className="ci-icon">📞</div>
              <div>
                <h4>Telefon</h4>
                <a href="tel:+4790407341">+47 904 07 341</a>
              </div>
            </div>
            <div className="ci">
              <div className="ci-icon">✉️</div>
              <div>
                <h4>E-post</h4>
                <a href="mailto:arve@astep.no">arve@astep.no</a>
              </div>
            </div>
            <div className="ci">
              <div className="ci-icon">📍</div>
              <div>
                <h4>Adresse</h4>
                <p>Postboks 79, 6281 Søvik, Norge</p>
              </div>
            </div>
            <div className="ci">
              <div className="ci-icon">🏛️</div>
              <div>
                <h4>Org.nr</h4>
                <p>998 196 159</p>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="team-mini">
            <p className="team-mini-label">Grunnleggerne</p>
            <div className="team-list">
              {TEAM.map((member) => (
                <div className="team-member" key={member.email}>
                  <div className="team-avatar">{member.initials}</div>
                  <div className="team-name">{member.name}</div>
                  <div className="team-email">{member.email}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <form className="contact-form reveal" onSubmit={handleSubmit}>
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
          <div className="form-row">
            <div className="fg">
              <label>Telefon</label>
              <input name="phone" type="tel" placeholder="+47 000 00 000" />
            </div>
            <div className="fg">
              <label>Fartøy/Rederi</label>
              <input name="company" type="text" placeholder="Fartøy/Rederi" />
            </div>
          </div>
          <div className="fg">
            <label>Produkt</label>
            <select name="product">
              <option>Argostep Livbåtleider</option>
              <option>Oppbevaringsskap</option>
              <option>Reservedeler</option>
              <option>Montering &amp; Lagring</option>
            </select>
          </div>
          <div className="fg">
            <label>Melding</label>
            <textarea
              name="message"
              placeholder="Fortell oss om dine behov (lengde på leider, fartøystype, osv.)"
            />
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
              {loading ? 'Sender…' : 'Send Forespørsel →'}
            </button>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '1rem',
                background: 'rgba(46,204,113,0.12)',
                borderRadius: '0.75rem',
                border: '1px solid var(--green)',
                color: 'var(--green)',
                fontWeight: 600,
              }}
            >
              ✓ Takk! Vi tar kontakt snart.
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
