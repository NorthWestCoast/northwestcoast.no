'use client';

import { useEffect, useRef } from 'react';

const STEPS = [
  {
    n: 1,
    title: 'Modulært System',
    desc: 'Enkel klikk-kobling for hvert trinn. Vedlikehold uten spesialverktøy – bytt ett trinn ved behov.',
  },
  {
    n: 2,
    title: 'Materialvalg',
    desc: 'Høykvalitets glassfiberarmert plast for trinn og fester. Stropper sikkert festet til hvert trinn – lett vekt og høy styrke.',
  },
  {
    n: 3,
    title: 'Lagringsløsning',
    desc: 'Dedikert skap beskyttet mot vær og vind. Forlenger levetiden og eliminerer slitasje fra eksponering.',
  },
  {
    n: 4,
    title: 'Rask Utsetting',
    desc: 'Klikkbare forlengere gir stabil støtte. Montering og demontering utføres raskt av én person.',
  },
];

export default function HowItWorks() {
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
    <section className="how" id="hvordan" ref={sectionRef}>
      <div className="how-grid reveal">
        <div>
          <div className="lbl">Se den i aksjon</div>
          <h2 className="stitle">Hvordan Argostep Fungerer</h2>
          <p className="sub" style={{ marginBottom: '1.8rem' }}>
            Argostep revolusjonerer ombordstigning. I motsetning til tradisjonelle treleidere
            bruker Argostep sprøytestøpt glassfiberarmert plast – kombinasjon av letthet, styrke og holdbarhet.
          </p>
          <div className="video-box">
            <iframe
              src="https://www.youtube.com/embed/3bB9M9vF80A?autoplay=0"
              title="Argostep Demonstration"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
        </div>

        <div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div
                className="step reveal"
                key={s.n}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="step-n">{s.n}</div>
                <div>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
