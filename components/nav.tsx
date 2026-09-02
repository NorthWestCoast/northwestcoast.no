'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/produkt',          label: 'Produkt' },
  { href: '/leiderkalkulator', label: 'Kalkulator' },
  { href: '/galleri',          label: 'Galleri' },
  { href: '/nyheter',          label: 'Nyheter' },
  { href: '/vedlikehold',      label: 'Vedlikehold' },
  { href: '/faq',              label: 'FAQ' },
];

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const [lang, setLang] = useState<'NO' | 'EN'>('NO');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isDesktop = () => window.innerWidth >= 960;
    const updateNav = () => {
      const nav = navRef.current;
      if (!nav) return;
      const scrolled = window.scrollY > 60;
      const horiz = isDesktop() ? '4rem' : '1.5rem';
      nav.style.padding = scrolled ? `0.7rem ${horiz}` : `1.1rem ${horiz}`;
      nav.style.background = scrolled ? 'rgba(10,22,40,0.98)' : 'rgba(10,22,40,0.85)';
    };

    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav);
    return () => {
      window.removeEventListener('scroll', updateNav);
      window.removeEventListener('resize', updateNav);
    };
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 960) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Skip link: first focusable element on every page, so keyboard users
          are not forced through the whole menu on each navigation. */}
      <a href="#hovedinnhold" className="skip-link">Hopp til hovedinnhold</a>

      <nav ref={navRef} id="navbar" aria-label="Hovedmeny">
        <Link className="nav-logo" href="/">
          <Image
            src="/images/logo/NY-logo.png"
            alt="NorthWest Coast"
            width={140}
            height={42}
            priority
          />
        </Link>

        <ul className="nav-links">
          {NAV_LINKS.map((l) => (
            <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
          ))}
        </ul>

        <div className="nav-right">
          <div className="nav-lang nav-lang-desktop">
            <button className={lang === 'NO' ? 'active' : ''} onClick={() => setLang('NO')}>NO</button>
            <button className={lang === 'EN' ? 'active' : ''} onClick={() => setLang('EN')}>EN</button>
          </div>
          <Link href="/bestill" className="nav-cta nav-cta-desktop">Bestill nå</Link>
          <button
            className="nav-burger"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Lukk meny' : 'Åpne meny'}
            aria-expanded={open}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <ul>
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
            </li>
          ))}
          <li>
            <Link href="/bestill" className="nav-drawer-cta" onClick={() => setOpen(false)}>Bestill nå</Link>
          </li>
        </ul>
        <div className="nav-lang nav-lang-mobile">
          <button className={lang === 'NO' ? 'active' : ''} onClick={() => setLang('NO')}>NO</button>
          <button className={lang === 'EN' ? 'active' : ''} onClick={() => setLang('EN')}>EN</button>
        </div>
      </div>
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
