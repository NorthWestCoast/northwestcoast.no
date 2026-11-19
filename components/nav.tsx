'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, User, X } from 'lucide-react';
import LangFlag from '@/components/lang-flag';
import { useLang, useT } from '@/components/lang-provider';
import { LANGS, localePath, stripLangPrefix, type Lang } from '@/lib/i18n';

/**
 * Fra denne bredden vises lenkene i selve navigasjonslinja; under den tar
 * hamburgermenyen over. Må følge @media (max-width: 1180px) i blokken
 * «OM OSS / PRODUKTER / 3D» i globals.css.
 */
const DESKTOP_MIN = 1181;

type NavLink = {
  href: string;
  label: string;
  /** Undersider. `drawer: false` holder mobilmenyen kort. */
  sub?: { href: string; label: string; drawer?: boolean }[];
};

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const lang = useLang();
  const t = useT();
  const pathname = usePathname() ?? '/';
  const basePath = stripLangPrefix(pathname);
  // Innlogget område og personvern finnes bare på norsk – ingen språkvelger der.
  const norwegianOnly = /^\/(minside|admin|logg-inn|personvern)(\/|$)/.test(basePath);

  const navLinks: NavLink[] = [
    {
      href: '/produkter',
      label: t.products.navLabel,
      sub: [
        { href: '/produkt', label: t.footer.ladder },
        { href: '/3d-leider', label: t.viewerPage.navLabel },
        { href: '/produkter#oppbevaring', label: t.order.cabinet, drawer: false },
        { href: '/produkter#reservedeler', label: t.products.anchors.parts, drawer: false },
      ],
    },
    { href: '/galleri', label: t.nav.galleri },
    { href: '/nyheter', label: t.nav.nyheter },
    { href: '/kalkulator', label: t.calculator.navLabel },
    { href: '/vedlikehold', label: t.nav.vedlikehold },
    { href: '/faq', label: t.nav.faq },
    { href: '/om-oss', label: t.about.navLabel },
  ];

  useEffect(() => {
    // Bare høyde og bakgrunn styres herfra. Sidemargene følger brekkpunktene
    // i CSS, så de ikke kommer i utakt med når hamburgermenyen tar over.
    const updateNav = () => {
      const nav = navRef.current;
      if (!nav) return;
      const scrolled = window.scrollY > 60;
      const vertical = scrolled ? '0.7rem' : '1.1rem';
      nav.style.paddingTop = vertical;
      nav.style.paddingBottom = vertical;
      nav.style.background = scrolled ? 'rgba(10,22,40,0.98)' : 'rgba(10,22,40,0.85)';
    };

    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
    return () => window.removeEventListener('scroll', updateNav);
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= DESKTOP_MIN) setOpen(false); };
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
          {navLinks.map((l) =>
            l.sub ? (
              // Undermenyen åpnes ved hover og tastaturfokus. Lenken selv går
              // til oversikten, så menyen er aldri eneste vei inn (berøring).
              <li
                key={l.href}
                className={`nav-has-sub${subOpen ? ' open' : ''}`}
                onMouseEnter={() => setSubOpen(true)}
                onMouseLeave={() => setSubOpen(false)}
                onFocus={() => setSubOpen(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSubOpen(false);
                }}
                onKeyDown={(e) => { if (e.key === 'Escape') setSubOpen(false); }}
              >
                <Link
                  href={localePath(lang, l.href)}
                  aria-expanded={subOpen}
                  onClick={() => setSubOpen(false)}
                >
                  {l.label}
                  <ChevronDown className="nav-caret" size={13} strokeWidth={2} aria-hidden="true" />
                </Link>
                <ul className="nav-sub">
                  {l.sub.map((s) => (
                    <li key={s.href}>
                      <Link href={localePath(lang, s.href)} onClick={() => setSubOpen(false)}>
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={l.href}>
                <Link href={localePath(lang, l.href)}>{l.label}</Link>
              </li>
            ),
          )}
        </ul>

        <div className="nav-right">
          {/* Min side finnes bare på norsk, derfor ingen språkprefiks. */}
          <Link href="/logg-inn" className="nav-account nav-account-desktop" title={t.account.title}>
            <User size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{t.account.navLabel}</span>
          </Link>
          {!norwegianOnly && (
            <div className="nav-lang nav-lang-desktop">{LANGS.map(langSwitch)}</div>
          )}
          <Link
            href={localePath(lang, '/bestill')}
            className="nav-cta nav-cta-desktop plausible-event-name=CTA:+Bestill plausible-event-source=nav"
          >
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
          {navLinks.flatMap((l) => [
            <li key={l.href}>
              <Link href={localePath(lang, l.href)} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            </li>,
            ...(l.sub ?? [])
              .filter((s) => s.drawer !== false)
              .map((s) => (
                <li key={s.href}>
                  <Link
                    href={localePath(lang, s.href)}
                    className="nav-drawer-sub"
                    onClick={() => setOpen(false)}
                  >
                    {s.label}
                  </Link>
                </li>
              )),
          ])}
          <li>
            <Link href="/logg-inn" className="nav-drawer-account" onClick={() => setOpen(false)}>
              <User size={17} strokeWidth={1.8} aria-hidden="true" />
              {t.account.navLabel}
            </Link>
          </li>
          <li>
            <Link
              href={localePath(lang, '/bestill')}
              className="nav-drawer-cta plausible-event-name=CTA:+Bestill plausible-event-source=meny"
              onClick={() => setOpen(false)}
            >
              {t.nav.drawerCta}
            </Link>
          </li>
        </ul>
        {!norwegianOnly && (
          <div className="nav-lang nav-lang-mobile">{LANGS.map(langSwitch)}</div>
        )}
      </div>
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
