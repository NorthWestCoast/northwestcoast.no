import Image from 'next/image';
import Link from 'next/link';

export default function Hero() {
  return (
    <div className="hero" id="topp">
      <div className="hero-bg-img" />
      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="hero-eyebrow">Fremtidens ombordstigning</div>
        {/*
          The wordmark alone is a weak h1: "ARGOSTEP" tells a search engine
          nothing about what the page is for. The visually hidden continuation
          gives the page's most important heading a real, descriptive string
          without changing the design a single pixel.
        */}
        <h1>
          ARGO<em>STEP</em>
          <span className="sr-only">
            {' '}– lett og modulær maritim leider for norske fartøy, godkjent av
            Sjøfartsdirektoratet og sertifisert etter ISO 799-1:2019
          </span>
        </h1>
        <p className="hero-desc">
          En lett og modulær leider, designet med fokus på sikkerhet.
          Godkjent av Sjøfartsdirektoratet. Produsert på Sunnmøre.
        </p>
        <div className="hero-actions">
          <Link href="/bestill" className="btn-primary">Bestill nå →</Link>
          <a href="#hvordan" className="btn-ghost">▶ Se hvordan det virker</a>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <div className="stat-num">2–15m</div>
            <div className="stat-label">Lengder</div>
          </div>
          <div className="stat">
            <div className="stat-num">ISO</div>
            <div className="stat-label">799-1:2019</div>
          </div>
          <div className="stat">
            <div className="stat-num">100%</div>
            <div className="stat-label">Norsk produksjon</div>
          </div>
        </div>
      </div>

      <div className="hero-product-img">
        <Image
          src="/images/ladder-hero.png"
          alt="Argostep maritim leider i full lengde, utfelt mot skutesiden"
          fill
          // The hero render is the LCP candidate on the front page: telling
          // next/image how wide it actually renders stops the browser from
          // downloading a 1920px variant on a phone.
          sizes="(max-width: 900px) 70vw, 40vw"
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>
    </div>
  );
}
