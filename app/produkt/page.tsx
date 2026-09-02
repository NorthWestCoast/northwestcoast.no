import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Features from '@/components/features';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';
import JsonLd from '@/components/json-ld';
import { pageOpenGraph } from '@/lib/site';
import { breadcrumbNode, graph, productNode, webPageNode } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Argostep Livbåtleider – spesifikasjoner, lengder og materiale',
  description:
    'Argostep Livbåtleider – modulær, lett og sterk maritim leider i glassfiberarmert plast. ISO 799-1:2019 sertifisert og godkjent av Sjøfartsdirektoratet. Leveres fra 2 til 15 meter.',
  alternates: { canonical: '/produkt' },
  openGraph: pageOpenGraph({
    path: '/produkt',
    title: 'Argostep Livbåtleider – spesifikasjoner, lengder og materiale',
    description:
      'Modulær maritim leider i glassfiberarmert plast. ISO 799-1:2019, godkjent av Sjøfartsdirektoratet, 2–15 meter.',
  }),
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
      {/* The canonical home of the Product entity: every variant, price and
          certification, so a shopping surface or an assistant can answer
          "what does a 9 metre Argostep cost" without guessing. */}
      <JsonLd
        data={graph([
          webPageNode({
            path: '/produkt',
            name: 'Argostep Livbåtleider',
            description:
              'Spesifikasjoner for Argostep Livbåtleider: lengder, materiale, sertifisering og bruksområder.',
            type: 'ItemPage',
          }),
          productNode(),
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'Produkt', path: '/produkt' },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

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
              alt="Argostep Livbåtleider i full lengde – modulær maritim leider i glassfiberarmert plast"
              fill
              sizes="(max-width: 900px) 100vw, 45vw"
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
              <Link href="/bestill" className="btn-primary">Bestill nå →</Link>
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

            <div className="prod-actions" style={{ marginTop: '2rem' }}>
              <Link href="/bestill" className="btn-primary">Bestill nå →</Link>
              {/* Contextual link from "which length do I need" to the tool that
                  answers it — the highest-intent internal link on the site. */}
              <Link href="/leiderkalkulator" className="btn-ghost">Regn ut riktig lengde →</Link>
            </div>
          </div>

          <div className="cert-img">
            <Image
              src="/images/leider_in_use.jpg"
              alt="Argostep Livbåtleider rigget langs skutesiden på et norsk fartøy"
              fill
              sizes="(max-width: 900px) 100vw, 45vw"
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
        <Link href="/bestill" className="btn-primary" style={{ display: 'inline-flex' }}>
          Bestill nå →
        </Link>
      </section>

      </main>

      <Footer />
      <Lightbox />
    </>
  );
}
