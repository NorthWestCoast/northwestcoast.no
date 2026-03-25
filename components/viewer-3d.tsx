'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

const VIEWER_INFOS = [
  {
    icon: '🔄',
    title: 'Full Utfelling',
    desc: 'Se leideren slik den ser ut klar for bruk – med alle trinn og stropper på plass.',
  },
  {
    icon: '🔍',
    title: 'Detaljtro Modell',
    desc: 'Glassfiberarmert plast trinn, klikkfester og sidestropper vist i detalj.',
  },
  {
    icon: '📐',
    title: 'Skalert korrekt',
    desc: 'Modellen representerer standard 7-trinns variant. Finner du riktig lengde for ditt fartøy?',
  },
];

export default function Viewer3D() {
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
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
        type="module"
        strategy="lazyOnload"
      />
      <section className="viewer-section" ref={sectionRef}>
        <div className="viewer-grid reveal">
          <div>
            <div className="lbl">Interaktiv 3D-modell</div>
            <h2 className="stitle">Se Stigen i 3D</h2>
            <p className="sub" style={{ marginBottom: '2rem' }}>
              Roter, zoom og utforsk Argostep i detalj. Klikk og dra for å rotere – skroll for å zoome.
            </p>
            <div className="viewer-info">
              {VIEWER_INFOS.map((info) => (
                <div className="vinfo" key={info.title}>
                  <div className="vinfo-icon">{info.icon}</div>
                  <div>
                    <strong>{info.title}</strong>
                    <p>{info.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <a href="/regelverk" className="btn-primary" style={{ marginTop: '2rem', display: 'inline-flex' }}>
              Sjekk krav til ditt fartøy →
            </a>
          </div>

          <div className="viewer-box">
            {/* @ts-expect-error – model-viewer is a custom web component */}
            <model-viewer
              src="/3d-models/leider-compressed-v2.glb"
              alt="Argostep 3D modell"
              auto-rotate
              camera-controls
              shadow-intensity="1"
              exposure="1.1"
              environment-image="neutral"
              style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0e2540 100%)', width: '100%', height: '100%' }}
              loading="eager"
              ar
            />
          </div>
        </div>
      </section>
    </>
  );
}
