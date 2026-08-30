'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const MINI_NEWS = [
  {
    src: '/images/ms-skar-senior2.jpeg',
    alt: 'Skar Senior',
    tag: 'Caser',
    title: 'M/S Skår Senior – ny Argostep installasjon',
    href: '/nyheter/ms-skar-senior-installasjon',
  },
];

export default function News() {
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
    <section className="news" id="nyheter" ref={sectionRef}>
      <div className="reveal">
        <div className="lbl lbl-dark">Siste nytt</div>
        <h2 className="stitle dark">Fra Bloggen</h2>
        <p className="sub dark">
          Hold deg oppdatert med nyheter, caser og forskrifter for maritime leidere.
        </p>
      </div>

      <div className="news-grid reveal">
        {/* Featured article */}
        <div className="news-card">
          <div className="news-img-box">
            <Image
              src="/images/leiderkasse.jpg"
              alt="Ny leiderkasse"
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="news-body">
            <span className="news-tag">Nyheter</span>
            <div className="news-date">📅 15. februar 2024</div>
            <h3>Ny leiderkasse på plass!</h3>
            <p>
              Vi har nylig fått inn en ny leiderkasse tilpasset leidere mellom 11 og 15 meter.
              På bildene ser du eksempler fra båten Geir, der kassene allerede er tatt i bruk.
            </p>
            <Link href="/nyheter/ny-leiderkasse" className="news-link">Les hele artikkelen →</Link>
          </div>
        </div>

        {/* Side articles */}
        <div className="news-side">
          {MINI_NEWS.map((n) => (
            <div className="news-mini" key={n.title}>
              <div className="news-mini-img">
                <Image src={n.src} alt={n.alt} fill style={{ objectFit: 'cover' }} />
              </div>
              <div className="news-mini-body">
                <span className="news-tag">{n.tag}</span>
                <h4>{n.title}</h4>
                <Link href={n.href} className="news-link" style={{ marginTop: '0.5rem' }}>
                  Les mer →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
        <Link
          href="/nyheter"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--green-dark)',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.95rem',
          }}
        >
          Se alle innlegg →
        </Link>
      </div>
    </section>
  );
}
