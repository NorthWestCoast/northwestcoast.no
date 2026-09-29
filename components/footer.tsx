'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Instagram, Linkedin } from 'lucide-react';
import { useLang, useT } from '@/components/lang-provider';
import { localePath } from '@/lib/i18n';
import { SOCIAL_LINKS } from '@/lib/social';

export default function Footer() {
  const lang = useLang();
  const t = useT();

  return (
    <>
      <footer>
        <div className="fbrand">
          <Image
            src="/images/logo/NY-logo.png"
            alt="NorthWest Coast"
            width={140}
            height={42}
          />
          <p>{t.footer.tagline}</p>
          <div className="fsocial">
            <a
              href={SOCIAL_LINKS.facebook}
              className="fsoc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <Facebook size={17} strokeWidth={1.8} />
            </a>
            <a
              href={SOCIAL_LINKS.instagram}
              className="fsoc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <Instagram size={17} strokeWidth={1.8} />
            </a>
            <a
              href={SOCIAL_LINKS.linkedin}
              className="fsoc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <Linkedin size={17} strokeWidth={1.8} />
            </a>
          </div>
        </div>

        <div className="fcol">
          <h4>{t.footer.products}</h4>
          <ul>
            <li><Link href={localePath(lang, '/produkt')}>{t.footer.ladder}</Link></li>
            <li><Link href={localePath(lang, '/produkt')}>{t.footer.parts}</Link></li>
            <li><Link href={localePath(lang, '/kalkulator')}>{t.calculator.navLabel}</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>{t.footer.company}</h4>
          <ul>
            <li><a href="#">{t.footer.about}</a></li>
            <li><Link href={`${localePath(lang, '/')}#sertifisering`}>{t.footer.certifications}</Link></li>
            <li><Link href={`${localePath(lang, '/')}#kontakt`}>{t.footer.contact}</Link></li>
            <li><Link href={localePath(lang, '/faq')}>{t.footer.faq}</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>{t.footer.office}</h4>
          <address>
            <span>{t.footer.addressLine1}</span>
            <span>{t.footer.addressLine2}</span>
            <span>{t.footer.orgNo}</span>
            <span style={{ marginTop: '0.3rem' }}>
              <a href="tel:+4790407341" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                +47 904 07 341
              </a>
            </span>
            <span>
              <a href="mailto:arve@astep.no" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                arve@astep.no
              </a>
            </span>
          </address>
        </div>
      </footer>

      <div className="fbot">
        <span>{t.footer.rights}</span>
        <span>{t.footer.madeWith}</span>
      </div>
    </>
  );
}
