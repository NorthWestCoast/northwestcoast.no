import Image from 'next/image';

export default function Hero() {
  return (
    <div className="hero" id="topp">
      <div className="hero-bg-img" />
      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="hero-eyebrow">Fremtidens ombordstigning</div>
        <h1>
          ARGO<em>STEP</em>
        </h1>
        <p className="hero-desc">
          Den lette, modulære leideren designet med fokus på maritim sikkerhet.
          Godkjent av Sjøfartsdirektoratet. Norsk produksjon fra Sunnmøre.
        </p>
        <div className="hero-actions">
          <a href="#kontakt" className="btn-primary">Be om tilbud →</a>
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
          alt="Argostep leider"
          fill
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>
    </div>
  );
}
