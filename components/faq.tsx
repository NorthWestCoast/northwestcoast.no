'use client';

import { useEffect, useRef } from 'react';
import { FAQS } from '@/lib/faqs';

export default function Faq() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="faq" id="faq" ref={sectionRef}>
      <div className="faq-layout">
        <div className="reveal">
          <div className="lbl">Spørsmål &amp; Svar</div>
          <h2 className="stitle">Ofte stilte spørsmål</h2>
          <p className="sub" style={{ marginBottom: '2rem' }}>
            Ikke funnet svaret? Kontakt oss direkte – vi hjelper gjerne.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="#kontakt" className="btn-primary" style={{ display: 'inline-flex' }}>
              Ta kontakt →
            </a>
            <a href="/faq" className="btn-ghost" style={{ display: 'inline-flex' }}>
              Se alle spørsmål →
            </a>
          </div>
        </div>

        <div className="faq-list reveal">
          {FAQS.slice(0, 4).map((faq) => (
            <details className="fi" key={faq.q}>
              <summary className="fq">
                {faq.q}
                <span className="fi-icon">+</span>
              </summary>
              <p className="fa">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
