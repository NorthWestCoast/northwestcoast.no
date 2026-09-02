import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/lib/site';

/**
 * Site footer.
 *
 * Two SEO-relevant fixes over the previous version:
 *
 * 1. The anchor links used to be bare fragments ("#kontakt", "#faq"). Those only
 *    resolve on the front page — from /produkt or /faq they pointed at nothing,
 *    which is a dead internal link on every subpage. They are now root-relative
 *    ("/#kontakt"), so they work from anywhere and pass link equity home.
 *
 * 2. "Om oss" pointed at "#", a href that crawlers follow and then discard. It
 *    now points at the section that actually carries the company story.
 *
 * The address block is also the site's visible NAP (name, address, phone) and is
 * kept byte-identical to lib/site.ts, which feeds the Organization JSON-LD —
 * consistency between the two is what lets search engines merge them into one
 * business entity rather than two half-confident ones.
 */

const SOCIALS = [
  { href: 'https://facebook.com', label: 'Facebook', short: 'f' },
  { href: 'https://instagram.com', label: 'Instagram', short: 'ig' },
  { href: 'https://linkedin.com', label: 'LinkedIn', short: 'in' },
];

export default function Footer() {
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
          <p>
            Maritimt sikkerhetsutstyr av høy kvalitet. Norsk produksjon fra Sunnmøre.
          </p>
          <div className="fsocial">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="fsoc"
                target="_blank"
                rel="noopener noreferrer"
                // The visible label is a one- or two-letter glyph; without this
                // the link announces as "f" to a screen reader and carries no
                // anchor text at all for a crawler.
                aria-label={`NorthWest Coast på ${s.label}`}
              >
                <span aria-hidden="true">{s.short}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="fcol">
          <h4>Produkter</h4>
          <ul>
            <li><Link href="/produkt">Argostep Livbåtleider</Link></li>
            <li><Link href="/bestill">Bestill og pris</Link></li>
            <li><Link href="/produkt">Reservedeler</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>Verktøy og hjelp</h4>
          <ul>
            <li><Link href="/leiderkalkulator">Leiderkalkulator</Link></li>
            <li><Link href="/vedlikehold">Vedlikehold</Link></li>
            <li><Link href="/faq">Ofte stilte spørsmål</Link></li>
            <li><Link href="/nyheter">Nyheter</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>Selskap</h4>
          <ul>
            <li><Link href="/#hvordan">Om oss</Link></li>
            <li><Link href="/#sertifisering">Sertifiseringer</Link></li>
            <li><Link href="/galleri">Galleri</Link></li>
            <li><Link href="/#kontakt">Kontakt</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>Kontor</h4>
          <address>
            <span>{SITE.address.poBox}</span>
            <span>{SITE.address.postalCode} {SITE.address.city}, Norge</span>
            <span>Org.nr: {SITE.orgNumber}</span>
            <span style={{ marginTop: '0.3rem' }}>
              <a href={`tel:${SITE.phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {SITE.phoneDisplay}
              </a>
            </span>
            <span>
              <a href={`mailto:${SITE.email}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {SITE.email}
              </a>
            </span>
          </address>
        </div>
      </footer>

      <div className="fbot">
        <span>© {new Date().getFullYear()} {SITE.legalName}. Alle rettigheter forbeholdt.</span>
        <span>Designet med ❤️ i Ålesund 🇳🇴</span>
      </div>
    </>
  );
}
