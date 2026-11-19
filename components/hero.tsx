'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLang, useT } from '@/components/lang-provider';
import { localePath } from '@/lib/i18n';

export default function Hero() {
  const lang = useLang();
  const t = useT();

  return (
    <div className="hero" id="topp">
      <div className="hero-bg-img" />
      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="hero-eyebrow">{t.hero.eyebrow}</div>
        <h1>
          ARGO<em>STEP</em>
          <span className="sr-only"> – {t.hero.h1Suffix}</span>
        </h1>
        <p className="hero-desc">{t.hero.desc}</p>
        <div className="hero-actions">
          <Link
            href={localePath(lang, '/bestill')}
            className="btn-primary plausible-event-name=CTA:+Bestill plausible-event-source=hero"
          >
            {t.hero.ctaOrder}
          </Link>
          <a href="#hvordan" className="btn-ghost">{t.hero.ctaHow}</a>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <div className="stat-num">2–15m</div>
            <div className="stat-label">{t.hero.statLengths}</div>
          </div>
          <div className="stat">
            <div className="stat-num">ISO</div>
            <div className="stat-label">{t.hero.statIso}</div>
          </div>
          <div className="stat">
            <div className="stat-num">100%</div>
            <div className="stat-label">{t.hero.statMade}</div>
          </div>
        </div>
      </div>

      <div className="hero-product-img">
        <Image
          src="/images/ladder-hero.png"
          alt="Argostep leider"
          fill sizes="(max-width: 960px) 100vw, 50vw"
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>
    </div>
  );
}
