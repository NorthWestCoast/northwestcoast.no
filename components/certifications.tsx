'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLang, useT } from '@/components/lang-provider';
import { localePath } from '@/lib/i18n';
import { openLightbox } from '@/lib/images';

export default function Certifications() {
  const sectionRef = useRef<HTMLElement>(null);
  const lang = useLang();
  const t = useT();

  const certs = [t.certs.cards.iso, t.certs.cards.nma, t.certs.cards.solas];
  const vessels = [
    t.certs.vessels.fishing,
    t.certs.vessels.service,
    t.certs.vessels.cargo,
    t.certs.vessels.passenger,
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="certs" id="sertifisering" ref={sectionRef}>
      <div className="certs-grid reveal">
        <div>
          <div className="lbl">{t.certs.label}</div>
          <h2 className="stitle">{t.certs.title}</h2>
          <p className="sub" style={{ marginBottom: '2rem' }}>{t.certs.sub}</p>
          <div className="cert-cards">
            {certs.map((c, i) => (
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
          <Link
            href={localePath(lang, '/bestill')}
            className="btn-primary"
            style={{ marginTop: '2rem', display: 'inline-flex' }}
          >
            {t.hero.ctaOrder}
          </Link>
        </div>

        <div>
          <div
            className="cert-img"
            style={{ cursor: 'pointer' }}
            onClick={() => openLightbox('/images/leiderkasse3.jpg')}
          >
            <Image
              src="/images/leiderkasse3.jpg"
              alt={t.gallery.images.case3.alt}
              fill sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
          </div>

          <div className="lbl" style={{ marginTop: '2rem' }}>{t.certs.vesselsLabel}</div>
          <div className="vessel-grid">
            {vessels.map((v) => (
              <div className="vessel" key={v}>{v}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
