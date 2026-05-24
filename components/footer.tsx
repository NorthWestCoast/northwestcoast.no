import Image from 'next/image';

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
            <a href="https://facebook.com" className="fsoc" target="_blank" rel="noopener noreferrer">f</a>
            <a href="https://instagram.com" className="fsoc" target="_blank" rel="noopener noreferrer">ig</a>
            <a href="https://linkedin.com" className="fsoc" target="_blank" rel="noopener noreferrer">in</a>
          </div>
        </div>

        <div className="fcol">
          <h4>Produkter</h4>
          <ul>
            <li><a href="#">Argostep Leider</a></li>
            <li><a href="#">Montering &amp; Lagring</a></li>
            <li><a href="#">Reservedeler</a></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>Selskap</h4>
          <ul>
            <li><a href="#">Om oss</a></li>
            <li><a href="#sertifisering">Sertifiseringer</a></li>
            <li><a href="#kontakt">Kontakt</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </div>

        <div className="fcol">
          <h4>Kontor</h4>
          <address>
            <span>Postboks 79</span>
            <span>6281 Søvik, Norge</span>
            <span>Org.nr: 998 196 159</span>
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
        <span>© 2026 Northwestcoast AS. Alle rettigheter forbeholdt.</span>
        <span>Designet med ❤️ i Ålesund 🇳🇴</span>
      </div>
    </>
  );
}
