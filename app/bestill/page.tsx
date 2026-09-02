import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import OrderConfigurator from '@/components/order-configurator';
import JsonLd from '@/components/json-ld';
import { pageOpenGraph } from '@/lib/site';
import { breadcrumbNode, graph, productNode, webPageNode } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Bestill Argostep Livbåtleider – pris og konfigurator',
  description:
    'Bestill din Argostep Livbåtleider. Velg lengde mellom 3 og 15 meter og tilbehør – og se leideren i 3D mens du konfigurerer. Veiledende priser fra 9 499 kr eks. mva.',
  alternates: { canonical: '/bestill' },
  openGraph: pageOpenGraph({
    path: '/bestill',
    title: 'Bestill Argostep Livbåtleider – pris og konfigurator',
    description: 'Velg lengde 3–15 meter og oppbevaringsskap, og se veiledende pris.',
  }),
};

export default function BestillPage() {
  return (
    <>
      <JsonLd
        data={graph([
          webPageNode({
            path: '/bestill',
            name: 'Bestill Argostep Livbåtleider',
            description: 'Konfigurator for lengde, antall og oppbevaringsskap med veiledende pris.',
            type: 'ItemPage',
          }),
          productNode(),
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'Bestill', path: '/bestill' },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Bestilling</div>
        <h1>Bestill din Argostep</h1>
        <p>
          Sett sammen leideren for ditt fartøy. Velg lengde mellom 3 og 15 meter og
          tilbehør – se den i 3D mens du konfigurerer.
        </p>
      </div>

      <section className="config-section">
        <OrderConfigurator />
      </section>

      </main>

      <Footer />
    </>
  );
}
