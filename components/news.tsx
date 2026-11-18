'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { useLang, useT } from '@/components/lang-provider';
import { ARTICLES, localizeArticle } from '@/lib/articles';
import { localePath } from '@/lib/i18n';

export default function News() {
  const sectionRef = useRef<HTMLElement>(null);
  const lang = useLang();
  const t = useT();
  const featured = localizeArticle(ARTICLES[0], lang);

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
        <div className="lbl lbl-dark">{t.news.label}</div>
        <h2 className="stitle dark">{t.news.title}</h2>
        <p className="sub dark">{t.news.sub}</p>
      </div>

      <div className="news-grid reveal">
        {/* Featured article */}
        <div className="news-card">
          <div className="news-img-box">
            <Image
              src={featured.image}
              alt={featured.title}
              fill sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="news-body">
            <span className="news-tag">{featured.tag}</span>
            <div className="news-date"><Calendar size={14} strokeWidth={1.6} /> {featured.date}</div>
            <h3>{featured.title}</h3>
            <p>{featured.teaser}</p>
            <Link href={localePath(lang, `/nyheter/${featured.slug}`)} className="news-link">
              {t.news.readFull}
            </Link>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
        <Link
          href={localePath(lang, '/nyheter')}
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
          {t.news.seeAll}
        </Link>
      </div>
    </section>
  );
}
