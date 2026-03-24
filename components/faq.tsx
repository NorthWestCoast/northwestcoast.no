'use client';

import { useEffect, useRef } from 'react';

const FAQS = [
  {
    q: 'Er stigen godkjent for norske skip?',
    a: 'Ja, Argostep Entrings- og Livbåtleider er sertifisert etter ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet for norske fartøy under 15 meter.',
  },
  {
    q: 'Hvilke lengder er tilgjengelige?',
    a: 'Argostep leveres fra 2 til 15 meter. Vi skreddersyr etter ditt fartøys nøyaktige spesifikasjoner.',
  },
  {
    q: 'Hvor lenge varer en leider?',
    a: 'Designet for lang levetid med utskiftbare komponenter. Korrekt lagring i det medfølgende skapet forlenger levetiden betraktelig.',
  },
  {
    q: 'Trenger jeg spesialverktøy for montering?',
    a: 'Nei. Argostep er designet for enkel montering og demontering uten spesialverktøy. Klikk-koblingen er intuitiv og kan betjenes av én person.',
  },
  {
    q: 'Hva er leveringstiden for Argostep?',
    a: 'Leveringstiden varierer avhengig av spesifikasjoner. Kontakt oss for et nøyaktig tilbud og estimert leveringstid for ditt fartøy.',
  },
];

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
          <a href="#kontakt" className="btn-primary" style={{ display: 'inline-flex' }}>
            Ta kontakt →
          </a>
        </div>

        <div className="faq-list reveal">
          {FAQS.map((faq) => (
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
