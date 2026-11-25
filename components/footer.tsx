'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Facebook, Instagram, Linkedin } from 'lucide-react';
import { useLang, useT } from '@/components/lang-provider';
import { localePath } from '@/lib/i18n';
import { isPortalPage, siteHref, SOCIAL_URLS } from '@/lib/site';

export default function Footer() {
  const lang = useLang();
  const t = useT();
  // Bunnteksten står også på sidene i portaldelen (innlogging, personvern),
  // som kan vises på portalens eget vertsnavn. Derfra får lenkene til de
  // offentlige sidene nettstedets adresse (se siteHref).
  const fromPortal = isPortalPage(usePathname() ?? '/');
  const site = (path: string) => {
    const href = localePath(lang, path);
    return fromPortal ? siteHref(href) : href;
  };

  return (
    <>
      <footer>
        <div className="fbrand">
          <Image
            src="/images/logo/NY-logo.png"
            alt="NorthWestCoast"
            width={140}
            height={42}
          />
          <p>{t.footer.tagline}</p>
          <div className="fsocial">
            <a
              href={SOCIAL_URLS.facebook}
              className="fsoc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <Facebook size={17} strokeWidth={1.8} />
            </a>
            <a
              href={SOCIAL_URLS.instagram}
              className="fsoc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <Instagram size={17} strokeWidth={1.8} />
            </a>
            <a
              href={SOCIAL_URLS.linkedin}
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
            <li><Link href={site('/produkter')}>{t.products.overview}</Link></li>
            <li><Link href={site('/produkt')}>{t.footer.ladder}</Link></li>
            <li><Link href={site('/3d-leider')}>{t.viewerPage.navLabel}</Link></li>
            <li><Link href={`${site('/produkter')}#reservedeler`}>{t.footer.parts}</Link></li>
            <li><Link href={site('/kalkulator')}>{t.calculator.navLabel}</Link></li>
            <li><Link href={site('/bestill')}>{t.footer.orderList}</Link></li>
            <li><Link href={site('/veiledning')}>{t.guide.navLabel}</Link></li>
            <li><Link href={site('/vedlikehold')}>{t.footer.maintenance}</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>{t.footer.company}</h4>
          <ul>
            <li><Link href={site('/om-oss')}>{t.footer.about}</Link></li>
            <li><Link href={`${site('/')}#sertifisering`}>{t.footer.certifications}</Link></li>
            <li><Link href={`${site('/')}#kontakt`}>{t.footer.contact}</Link></li>
            <li><Link href={site('/faq')}>{t.footer.faq}</Link></li>
            <li><Link href={site('/nyheter')}>{t.footer.news}</Link></li>
            {/* Personvernerklæringen finnes bare på norsk. */}
            <li><Link href="/personvern">{t.footer.privacy}</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>{t.footer.office}</h4>
          <address>
            <span>{t.footer.addressLine1}</span>
            <span>{t.footer.addressLine2}</span>
            <span>{t.footer.orgNo}</span>
            <span style={{ marginTop: '0.3rem' }}>
              <a
                href="tel:+4790407341"
                className="plausible-event-name=Lead:+Phone+click plausible-event-source=footer"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                +47 904 07 341
              </a>
            </span>
            <span>
              <a
                href="mailto:arve@astep.no"
                className="plausible-event-name=Lead:+Email+click plausible-event-source=footer"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
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
