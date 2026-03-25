'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/#hvordan',      label: 'Produkt' },
  { href: '/galleri',       label: 'Galleri' },
  { href: '/regelverk',     label: 'Regelverk' },
  { href: '/nyheter',       label: 'Nyheter' },
  { href: '/faq',           label: 'FAQ' },
];

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const [lang, setLang] = useState<'NO' | 'EN'>('NO');
  const [open, setOpen] = useState(false);

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

  // Close drawer on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 960) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <nav ref={navRef} id="navbar">
        <a className="nav-logo" href="/">
          <Image
            src="/images/logo/logo-light.png"
            alt="NorthWest Coast"
            width={120}
            height={38}
            priority
          />
        </a>

        <ul className="nav-links">
          {NAV_LINKS.map((l) => (
            <li key={l.href}><a href={l.href}>{l.label}</a></li>
          ))}
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="nav-lang">
            <button className={lang === 'NO' ? 'active' : ''} onClick={() => setLang('NO')}>NO</button>
            <button className={lang === 'EN' ? 'active' : ''} onClick={() => setLang('EN')}>EN</button>
          </div>
          <a href="#kontakt" className="nav-cta nav-cta-desktop">Be om tilbud</a>
          <button className="nav-burger" onClick={() => setOpen((v) => !v)} aria-label="Meny">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <ul>
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
            </li>
          ))}
          <li>
            <a href="#kontakt" className="nav-drawer-cta" onClick={() => setOpen(false)}>Be om tilbud</a>
          </li>
        </ul>
      </div>
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
