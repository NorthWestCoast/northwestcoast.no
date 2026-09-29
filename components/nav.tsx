'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import LangFlag from '@/components/lang-flag';
import { useLang, useT } from '@/components/lang-provider';
import { EVENTS, track } from '@/lib/analytics';
import { LANGS, localePath, stripLangPrefix, type Lang } from '@/lib/i18n';

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const lang = useLang();
  const t = useT();
  const pathname = usePathname() ?? '/';
  const basePath = stripLangPrefix(pathname);

  const navLinks = [
    { href: '/produkt', label: t.nav.produkt },
    { href: '/galleri', label: t.nav.galleri },
    { href: '/nyheter', label: t.nav.nyheter },
    { href: '/kalkulator', label: t.calculator.navLabel },
    { href: '/vedlikehold', label: t.nav.vedlikehold },
    { href: '/faq', label: t.nav.faq },
  ];

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

  // Språkbytte er en hard navigasjon, slik at <html lang> og metadata
  // faktisk følger med over til det andre språket.
  const langSwitch = (target: Lang) => (
    <a
      key={target}
      href={localePath(target, basePath)}
      className={lang === target ? 'active' : ''}
      hrefLang={target}
      aria-current={lang === target ? 'true' : undefined}
      onClick={() => track(EVENTS.languageSwitched, { from: lang, to: target })}
    >
      <span className="nav-lang-flag" aria-hidden="true">
        <LangFlag lang={target} />
      </span>
      <span className="nav-lang-label">{target.toUpperCase()}</span>
    </a>
  );

  return (
    <>
      <nav ref={navRef} id="navbar">
        <Link className="nav-logo" href={localePath(lang, '/')}>
          <Image
            src="/images/logo/NY-logo.png"
            alt="NorthWest Coast"
            width={140}
            height={42}
            priority
          />
        </Link>

        <ul className="nav-links">
          {navLinks.map((l) => (
            <li key={l.href}>
              <Link href={localePath(lang, l.href)}>{l.label}</Link>
            </li>
          ))}
        </ul>

        <div className="nav-right">
          <div className="nav-lang nav-lang-desktop">{LANGS.map(langSwitch)}</div>
          <Link href={localePath(lang, '/bestill')} className="nav-cta nav-cta-desktop">
            {t.nav.cta}
          </Link>
          <button className="nav-burger" onClick={() => setOpen((v) => !v)} aria-label={t.nav.menu}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <ul>
          {navLinks.map((l) => (
            <li key={l.href}>
              <Link href={localePath(lang, l.href)} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={localePath(lang, '/bestill')}
              className="nav-drawer-cta"
              onClick={() => setOpen(false)}
            >
              {t.nav.drawerCta}
            </Link>
          </li>
        </ul>
        <div className="nav-lang nav-lang-mobile">{LANGS.map(langSwitch)}</div>
      </div>
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
