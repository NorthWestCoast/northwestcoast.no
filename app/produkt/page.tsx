import type { Metadata } from 'next';
import Image from 'next/image';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Features from '@/components/features';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';

export const metadata: Metadata = {
  title: 'Argostep Livbåtleider – Produkt | NorthWest Coast',
  description:
    'Argostep Livbåtleider – modulær, lett og sterk maritim leider i glassfiberarmert plast. ISO 799-1:2019 sertifisert og godkjent av Sjøfartsdirektoratet. Leveres fra 2 til 15 meter.',
};

const SPECS = [
  { key: 'Lengder', val: '2 – 15 meter (standard)' },
  { key: 'Materiale', val: 'Glassfiberarmert plast' },
  { key: 'Sertifisering', val: 'ISO 799-1:2019' },
  { key: 'Godkjenning', val: 'Sjøfartsdirektoratet' },
  { key: 'System', val: 'Modulært klikk-koblet' },
  { key: 'Vedlikehold', val: 'Utskiftbare enkelttrinn' },
];

const VESSELS = [
  'Fiskefartøy under 15m',
  'Servicefartøy under 15m',
  'Mindre lasteskip',
  'Passasjerfartøy',
];

export default function ProduktPage() {
  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Produkt</div>
        <h1>Argostep Livbåtleider</h1>
        <p>
          Den lette, modulære maritime leideren – bygget for trygg ombordstigning langs
          norskekysten. Sertifisert, holdbar og skreddersydd ditt fartøy.
        </p>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      {/* Produktoversikt */}
      <section className="product-intro">
        <div className="product-grid">
          <div className="product-img">
            <Image
              src="/images/ladder-full.png"
              alt="Argostep Livbåtleider i full lengde"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          <div>
            <div className="lbl lbl-dark">Maritim leider</div>
            <h2 className="stitle dark">Bygget for norske fartøy</h2>
            <p className="sub dark" style={{ marginBottom: '0.5rem' }}>
              Argostep Livbåtleider er betydelig lettere enn tradisjonelle treleidere og langt mer
              holdbar. Det modulære klikk-systemet gjør utsetting og innhenting raskt – og slitte
              trinn kan byttes enkeltvis i stedet for hele leideren.
            </p>

            <div className="spec-list">
              {SPECS.map((s) => (
                <div className="spec-item" key={s.key}>
                  <span className="spec-key">{s.key}</span>
                  <span className="spec-val">{s.val}</span>
                </div>
              ))}
            </div>

            <div className="prod-actions">
              <a href="/#kontakt" className="btn-primary">Bestill / Be om tilbud →</a>
              <a href="tel:+4790407341" className="btn-ghost">Ring +47 904 07 341</a>
            </div>
          </div>
        </div>
      </section>

      <Features />

      <Wave top="var(--sand)" bottom="var(--navy-mid)" dual dualBottomFill="var(--navy-mid)" />

      {/* Tekniske detaljer + egnet for */}
      <section className="certs">
        <div className="certs-grid">
          <div>
            <div className="lbl">Tilpasning</div>
            <h2 className="stitle">Skreddersydd ditt fartøy</h2>
            <p className="sub" style={{ marginBottom: '1.5rem' }}>
              Argostep Livbåtleider leveres som standard lengder fra 2 til 15 meter. Ta kontakt ved
              andre behov, så skreddersyr vi en pakke for deg – inkludert oppbevaringsskap og
              reservedeler.
            </p>

            <div className="lbl">Egnet for</div>
            <div className="vessel-grid">
              {VESSELS.map((v) => (
                <div className="vessel" key={v}>{v}</div>
              ))}
            </div>

            <a href="/#kontakt" className="btn-primary" style={{ marginTop: '2rem', display: 'inline-flex' }}>
              Be om tilbud →
            </a>
          </div>

          <div className="cert-img">
            <Image
              src="/images/leider_in_use.jpg"
              alt="Argostep Livbåtleider i bruk"
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* Bestillingsbånd */}
      <section className="order-band">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Klar til å bestille?</div>
        <h2>Sikre fartøyet ditt med Argostep</h2>
        <p>
          Fortell oss om fartøyet ditt, så setter vi sammen riktig leiderløsning og sender deg et
          tilbud raskt.
        </p>
        <a href="/#kontakt" className="btn-primary" style={{ display: 'inline-flex' }}>
          Bestill nå →
        </a>
      </section>

      <Footer />
      <Lightbox />
    </>
  );
}
