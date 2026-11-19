'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLang, useT } from '@/components/lang-provider';
import { localePath } from '@/lib/i18n';
import { FAQ_ITEMS } from '@/lib/faq-items';


export default function Faq() {
  const sectionRef = useRef<HTMLElement>(null);
  const lang = useLang();
  const t = useT();

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
          <div className="lbl">{t.faq.label}</div>
          <h2 className="stitle">{t.faq.title}</h2>
          <p className="sub" style={{ marginBottom: '2rem' }}>{t.faq.sub}</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="#kontakt" className="btn-primary" style={{ display: 'inline-flex' }}>
              {t.faq.contactCta}
            </a>
            <Link href={localePath(lang, '/faq')} className="btn-ghost" style={{ display: 'inline-flex' }}>
              {t.faq.allCta}
            </Link>
          </div>
        </div>

        <div className="faq-list reveal">
          {FAQ_ITEMS.slice(0, 4).map(({ key }) => {
            const item = t.faq.items[key];
            return (
              <details className="fi" key={key}>
                <summary className="fq">
                  {item.q}
                  <span className="fi-icon">+</span>
                </summary>
                <p className="fa">{item.a}</p>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
