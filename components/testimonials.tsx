'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

const TESTIMONIALS = [
  {
    shipImg: '/images/tindskjaer.jpg',
    shipAlt: 'M/S Tindskjær',
    quote: 'Vi fikk godkjenning! Veldig fornøyd med dette. Også flott for små jobber langs skutesiden.',
    initials: 'MT',
    name: 'M/S Tindskjær',
    company: 'Tindskjær AS',
  },
  {
    shipImg: null,
    shipAlt: null,
    quote: 'Enkel å montere og tar minimalt med plass. Anbefales på det sterkeste!',
    initials: 'RS',
    name: 'Ro Spirit',
    company: 'Rostein AS',
  },
  {
    shipImg: '/images/ms-skar-senior.jpeg',
    shipAlt: 'M/S Skår Senior',
    quote: 'Solid kvalitet og gjennomtenkt design. Vi er veldig fornøyde med produktet.',
    initials: 'RV',
    name: 'Ronja Vest',
    company: 'Sølvtrans Rederi AS',
  },
];

export default function Testimonials() {
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
    <section className="testi" ref={sectionRef}>
      <div className="reveal" style={{ textAlign: 'center' }}>
        <div className="lbl lbl-center">Kundetilbakemeldinger</div>
        <h2 className="stitle" style={{ textAlign: 'center' }}>Hva våre kunder sier</h2>
        <p className="sub" style={{ margin: '0.7rem auto', textAlign: 'center' }}>
          Velg Argostep og bli en av våre mange fornøyde kunder langs norskekysten.
        </p>
      </div>

      <div className="testi-grid reveal">
        {TESTIMONIALS.map((t, i) => (
          <div
            className="testi-card reveal"
            key={t.name}
            style={{ transitionDelay: `${i * 0.1}s` }}
          >
            <div className="testi-ship">
              {t.shipImg ? (
                <Image src={t.shipImg} alt={t.shipAlt!} fill style={{ objectFit: 'cover' }} />
              ) : (
                <div style={{
                  background: 'linear-gradient(135deg,#0a1628,#1a3358)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '4rem',
                  borderRadius: '0.9rem',
                  height: '140px',
                }}>
                  ⛵
                </div>
              )}
            </div>
            <div className="quote-mark">&ldquo;</div>
            <blockquote>{t.quote}</blockquote>
            <div className="testi-author">
              <div className="tauthor-av">{t.initials}</div>
              <div>
                <div className="tauthor-name">{t.name}</div>
                <div className="tauthor-co">{t.company}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
