'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

const CERTS = [
  { title: 'ISO 799-1:2019', sub: 'Sertifisert for skip og maritim teknologi' },
  { title: 'Sjøfartsdirektoratet', sub: 'Godkjent for norske fartøy under 15 meter' },
  { title: 'SOLAS-kompatibel', sub: 'Oppfyller internasjonale sikkerhetskrav' },
];

const VESSELS = [
  'Fiskefartøy under 15m',
  'Servicefartøy under 15m',
  'Mindre lasteskip',
  'Passasjerfartøy',
];

export default function Certifications() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const openLightbox = (src: string) => {
    const lb = document.getElementById('lightbox') as HTMLElement | null;
    const img = document.getElementById('lb-img') as HTMLImageElement | null;
    if (lb && img) { img.src = src; lb.classList.add('open'); }
  };

  return (
    <section className="certs" id="sertifisering" ref={sectionRef}>
      <div className="certs-grid reveal">
        <div>
          <div className="lbl">Sikkerhet først</div>
          <h2 className="stitle">Sertifisert for Sikkerhet</h2>
          <p className="sub" style={{ marginBottom: '2rem' }}>
            Argostep er bygget etter de høyeste standarder – og vi sikter alltid mot å overgå dem.
          </p>
          <div className="cert-cards">
            {CERTS.map((c, i) => (
              <div
                className="cert-card reveal"
                key={c.title}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="cert-tick">✓</div>
                <div>
                  <h4>{c.title}</h4>
                  <span>{c.sub}</span>
                </div>
              </div>
            ))}
          </div>
          <a href="/bestill" className="btn-primary" style={{ marginTop: '2rem', display: 'inline-flex' }}>
            Bestill nå →
          </a>
        </div>

        <div>
          <div
            className="cert-img"
            style={{ cursor: 'pointer' }}
            onClick={() => openLightbox('/images/leiderkasse3.jpg')}
          >
            <Image
              src="/images/leiderkasse3.jpg"
              alt="Argostep ombord"
              fill
              sizes="(max-width: 900px) 100vw, 45vw"
              style={{ objectFit: 'cover' }}
            />
          </div>

          <div className="lbl" style={{ marginTop: '2rem' }}>Egnet for</div>
          <div className="vessel-grid">
            {VESSELS.map((v) => (
              <div className="vessel" key={v}>{v}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
