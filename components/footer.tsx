import Image from 'next/image';
import Link from 'next/link';

/**
 * Sosiale profiler settes med env-variabler. Er en ikke satt, vises ikonet
 * ikke – tidligere pekte alle tre på f.eks. facebook.com (forsiden), som
 * sendte besøkende ut av siden uten å lande noe sted.
 */
const SOCIALS = [
  { key: 'facebook',  label: 'f',  url: process.env.NEXT_PUBLIC_FACEBOOK_URL,  name: 'Facebook' },
  { key: 'instagram', label: 'ig', url: process.env.NEXT_PUBLIC_INSTAGRAM_URL, name: 'Instagram' },
  { key: 'linkedin',  label: 'in', url: process.env.NEXT_PUBLIC_LINKEDIN_URL,  name: 'LinkedIn' },
].filter((s): s is typeof s & { url: string } => Boolean(s.url));

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
          {SOCIALS.length > 0 && (
            <div className="fsocial">
              {SOCIALS.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  className="fsoc"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="fcol">
          <h4>Produkter</h4>
          <ul>
            <li><Link href="/produkt">Argostep Livbåtleider</Link></li>
            <li><Link href="/bestill">Bestill / prisliste</Link></li>
            <li><Link href="/vedlikehold">Vedlikehold</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>Selskap</h4>
          <ul>
            {/* Absolutte stier – ankerlenkene virket bare fra forsiden. */}
            <li><Link href="/#sertifisering">Sertifiseringer</Link></li>
            <li><Link href="/#kontakt">Kontakt</Link></li>
            <li><Link href="/faq">FAQ</Link></li>
            <li><Link href="/nyheter">Nyheter</Link></li>
            <li><Link href="/personvern">Personvern</Link></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>Kontor</h4>
          <address>
            <span>Postboks 79</span>
            <span>6281 Søvik, Norge</span>
            <span>Org.nr: 998 196 159</span>
            <span style={{ marginTop: '0.3rem' }}>
              <a
                href="tel:+4790407341"
                className="plausible-event-name=Lead:+Phone+click plausible-event-source=footer"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                +47 904 07 341
              </a>
            </span>
            <span>
              <a
                href="mailto:arve@astep.no"
                className="plausible-event-name=Lead:+Email+click plausible-event-source=footer"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                arve@astep.no
              </a>
            </span>
          </address>
        </div>
      </footer>

      <div className="fbot">
        <span>© 2026 Northwestcoast AS. Alle rettigheter forbeholdt.</span>
        <span>Designet med ❤️ i Ålesund 🇳🇴</span>
      </div>
    </>
  );
}
