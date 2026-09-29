'use client';

import { useEffect, useRef, useState } from 'react';
import { Landmark, Mail, MapPin, Phone, User } from 'lucide-react';
import { useLang, useT } from '@/components/lang-provider';
import { track } from '@/lib/analytics';

const TEAM = [
  { name: 'Kristian B. Dyb', email: 'kristian@astep.no' },
  { name: 'Arve Toven',      email: 'arve@astep.no' },
  { name: 'Tor Arne Reitan', email: 'tor@astep.no' },
];

export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = useLang();
  const t = useT();

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
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, lang }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.errors.generic);
      }
      track('Lead: Contact form', { props: { product: String(data.product ?? 'ukjent') } });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="contact" id="kontakt" ref={sectionRef}>
      <div className="contact-grid">
        {/* Contact info */}
        <div className="reveal">
          <div className="lbl">{t.contact.label}</div>
          <h2 className="stitle">{t.contact.title}</h2>
          <p className="sub" style={{ marginBottom: '0.5rem' }}>{t.contact.sub}</p>
          <div className="contact-info">
            <div className="ci">
              <div className="ci-icon"><Phone size={18} strokeWidth={1.6} /></div>
              <div>
                <h4>{t.contact.phone}</h4>
                <a href="tel:+4790407341">+47 904 07 341</a>
              </div>
            </div>
            <div className="ci">
              <div className="ci-icon"><Mail size={18} strokeWidth={1.6} /></div>
              <div>
                <h4>{t.contact.email}</h4>
                <a href="mailto:arve@astep.no">arve@astep.no</a>
              </div>
            </div>
            <div className="ci">
              <div className="ci-icon"><MapPin size={18} strokeWidth={1.6} /></div>
              <div>
                <h4>{t.contact.address}</h4>
                <p>{t.contact.addressValue}</p>
              </div>
            </div>
            <div className="ci">
              <div className="ci-icon"><Landmark size={18} strokeWidth={1.6} /></div>
              <div>
                <h4>{t.contact.orgNo}</h4>
                <p>998 196 159</p>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="team-mini">
            <p className="team-mini-label">{t.contact.founders}</p>
            <div className="team-list">
              {TEAM.map((member) => (
                <div className="team-member" key={member.email}>
                  <div className="team-avatar"><User size={16} strokeWidth={1.6} /></div>
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
              <label>{t.contact.form.name}</label>
              <input name="name" type="text" placeholder={t.contact.form.namePlaceholder} required />
            </div>
            <div className="fg">
              <label>{t.contact.form.email}</label>
              <input name="email" type="email" placeholder={t.contact.form.emailPlaceholder} required />
            </div>
          </div>
          <div className="form-row">
            <div className="fg">
              <label>{t.contact.form.phone}</label>
              <input name="phone" type="tel" placeholder={t.contact.form.phonePlaceholder} />
            </div>
            <div className="fg">
              <label>{t.contact.form.company}</label>
              <input name="company" type="text" placeholder={t.contact.form.companyPlaceholder} />
            </div>
          </div>
          <div className="fg">
            <label>{t.contact.form.product}</label>
            <select name="product">
              <option>{t.contact.form.productOptions.ladder}</option>
              <option>{t.contact.form.productOptions.cabinet}</option>
              <option>{t.contact.form.productOptions.parts}</option>
            </select>
          </div>
          <div className="fg">
            <label>{t.contact.form.message}</label>
            <textarea name="message" placeholder={t.contact.form.messagePlaceholder} />
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
              {loading ? t.contact.form.sending : t.contact.form.submit}
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
              {t.contact.form.success}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
