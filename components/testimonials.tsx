'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Ship } from 'lucide-react';
import { useT } from '@/components/lang-provider';

const SHIPS = [
  { shipImg: '/images/tindskjaer.jpg',      shipAlt: 'M/S Tindskjær',   initials: 'MT', name: 'M/S Tindskjær', company: 'Tindskjær AS' },
  { shipImg: null,                          shipAlt: null,              initials: 'RS', name: 'Ro Spirit',     company: 'Rostein AS' },
  { shipImg: '/images/ms-skar-senior.jpeg', shipAlt: 'M/S Skår Senior', initials: 'RV', name: 'Ronja Vest',    company: 'Sølvtrans Rederi AS' },
];

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const t = useT();

  const quotes = [
    t.testimonials.quotes.tindskjaer,
    t.testimonials.quotes.rostein,
    t.testimonials.quotes.solvtrans,
  ];
  const testimonials = SHIPS.map((ship, i) => ({ ...ship, quote: quotes[i] }));

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
        <div className="lbl lbl-center">{t.testimonials.label}</div>
        <h2 className="stitle" style={{ textAlign: 'center' }}>{t.testimonials.title}</h2>
        <p className="sub" style={{ margin: '0.7rem auto', textAlign: 'center' }}>
          {t.testimonials.sub}
        </p>
      </div>

      <div className="testi-grid reveal">
        {testimonials.map((item, i) => (
          <div
            className="testi-card reveal"
            key={item.name}
            style={{ transitionDelay: `${i * 0.1}s` }}
          >
            <div className="testi-ship">
              {item.shipImg ? (
                <Image src={item.shipImg} alt={item.shipAlt!} fill sizes="(max-width: 960px) 85vw, 33vw" style={{ objectFit: 'cover' }} />
              ) : (
                <div style={{
                  background: 'var(--navy-light)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--r-lg)',
                  height: '140px',
                }}>
                  <Ship size={44} strokeWidth={1.2} />
                </div>
              )}
            </div>
            <div className="quote-mark">&ldquo;</div>
            <blockquote>{item.quote}</blockquote>
            <div className="testi-author">
              <div className="tauthor-av">{item.initials}</div>
              <div>
                <div className="tauthor-name">{item.name}</div>
                <div className="tauthor-co">{item.company}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
