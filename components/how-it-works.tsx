'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/lang-provider';

const VIDEO_ID = '3bB9M9vF80A';

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const t = useT();

  const steps = [t.how.steps.modular, t.how.steps.material, t.how.steps.storage, t.how.steps.deploy];

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
          <div className="lbl">{t.how.label}</div>
          <h2 className="stitle">{t.how.title}</h2>
          <p className="sub" style={{ marginBottom: '1.8rem' }}>{t.how.sub}</p>
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
              <button className="yt-facade" onClick={() => setPlaying(true)} aria-label={t.how.playLabel}>
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
            {steps.map((step, i) => (
              <div
                className="step reveal"
                key={step.title}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="step-n">{i + 1}</div>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
