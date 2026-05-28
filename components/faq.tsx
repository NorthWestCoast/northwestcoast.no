'use client';

import { useEffect, useRef } from 'react';

export const FAQS = [
  {
    q: 'Er stigen godkjent for norske skip?',
    a: 'Ja, Argostep Entrings- og Livbåtleider er sertifisert etter ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet for norske fartøy.',
    category: 'Sertifisering',
  },
  {
    q: 'Hvilke lengder er tilgjengelige?',
    a: 'Argostep Livbåtleider leveres som standard lengder fra 2 - 15 meter. Ta kontakt ved andre behov så skreddersyr vi en pakke for deg.',
    category: 'Produkt',
  },
  {
    q: 'Hvor lenge varer en leider?',
    a: 'Designet for lang levetid med utskiftbare komponenter. Korrekt lagring i det medfølgende skapet forlenger levetiden betraktelig.',
    category: 'Produkt',
  },
  {
    q: 'Trenger jeg spesialverktøy for montering?',
    a: 'Nei. Argostep er designet for enkel montering og demontering uten spesialverktøy. Klikk-koblingen er intuitiv og kan betjenes av én person.',
    category: 'Montering',
  },
  {
    q: 'Hva er leveringstiden for Argostep?',
    a: 'Leveringstiden varierer avhengig av spesifikasjoner. Kontakt oss for et nøyaktig tilbud og estimert leveringstid for ditt fartøy.',
    category: 'Leveranse',
  },
  {
    q: 'Av hvilket materiale er leideren laget?',
    a: 'Trinnene og festene er laget av sprøytestøpt glassfiberarmert plast – et materiale som kombinerer lav vekt, høy styrke og utmerket korrosjonsbestandighet i saltvannsmiljø.',
    category: 'Produkt',
  },
  {
    q: 'Kan leideren brukes på alle typer fartøy?',
    a: 'Argostep er egnet for fiskefartøy, servicebåter, passasjerfartøy og mindre lasteskip under 15 meter. Ta kontakt for å avklare om leideren passer til ditt spesifikke fartøy.',
    category: 'Produkt',
  },
  {
    q: 'Hva veier en standard Argostep?',
    a: 'En standard 8-trinns Argostep veier betydelig mindre enn en tilsvarende treeleider, takket være glassfiberarmert plast. Nøyaktig vekt avhenger av lengde og konfigurasjon.',
    category: 'Produkt',
  },
  {
    q: 'Kan jeg montere leideren selv?',
    a: 'Ja, Argostep er konstruert for selvmontering. Medfølgende monteringsveiledning og klikk-koblingssystemet gjør det mulig å montere leideren uten fagfolk.',
    category: 'Montering',
  },
  {
    q: 'Tilbyr dere reservedeler og service?',
    a: 'Ja. Et av hovedfordelene med Argostep er det modulære systemet – enkelttrinn og komponenter kan bestilles separat. Kontakt oss for reservedeler eller serviceavtale.',
    category: 'Leveranse',
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
