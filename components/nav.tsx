'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const [lang, setLang] = useState<'NO' | 'EN'>('NO');

  useEffect(() => {
    const onScroll = () => {
      const nav = navRef.current;
      if (!nav) return;
      if (window.scrollY > 60) {
        nav.style.padding = '0.7rem 4rem';
        nav.style.background = 'rgba(10,22,40,0.98)';
      } else {
        nav.style.padding = '1.1rem 4rem';
        nav.style.background = 'rgba(10,22,40,0.85)';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav ref={navRef} id="navbar">
      <a className="nav-logo" href="#topp">
        <Image
          src="/images/logo/logo-light.png"
          alt="NorthWest Coast"
          width={120}
          height={38}
          priority
        />
      </a>

      <ul className="nav-links">
        <li><a href="#hvordan">Produkt</a></li>
        <li><a href="#produkter">Galleri</a></li>
        <li><a href="#sertifisering">Sertifisering</a></li>
        <li><a href="#nyheter">Nyheter</a></li>
        <li><a href="#faq">FAQ</a></li>
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="nav-lang">
          <button
            className={lang === 'NO' ? 'active' : ''}
            onClick={() => setLang('NO')}
          >
            NO
          </button>
          <button
            className={lang === 'EN' ? 'active' : ''}
            onClick={() => setLang('EN')}
          >
            EN
          </button>
        </div>
        <a href="#kontakt" className="nav-cta">Be om tilbud</a>
      </div>
    </nav>
  );
}
