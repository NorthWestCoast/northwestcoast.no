'use client';

import { useEffect, useRef, useState } from 'react';

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

const VIDEO_ID = '3bB9M9vF80A';

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);

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
            Argostep forenkler ombordstigning. Sammenlignet med tradisjonelle treleidere
            er Argostep lettere, sterkere og mer holdbar – takket være glassfiberarmert plast.
          </p>
          <div className="video-box">
            {playing ? (
              <iframe
                src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
                title="Argostep Demonstration"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            ) : (
              <button className="yt-facade" onClick={() => setPlaying(true)} aria-label="Spill av video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`}
                  alt="Argostep Demonstration"
                  className="yt-thumb"
                />
                <span className="yt-play">
                  <svg viewBox="0 0 68 48" width="68" height="48">
                    <path d="M66.5 7.8a8.5 8.5 0 0 0-6-6C56 0 34 0 34 0S12 0 7.5 1.8a8.5 8.5 0 0 0-6 6C0 12.3 0 24 0 24s0 11.7 1.5 16.2a8.5 8.5 0 0 0 6 6C12 48 34 48 34 48s22 0 26.5-1.8a8.5 8.5 0 0 0 6-6C68 35.7 68 24 68 24s0-11.7-1.5-16.2z" fill="red"/>
                    <path d="M27 34l18-10-18-10v20z" fill="white"/>
                  </svg>
                </span>
              </button>
            )}
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
