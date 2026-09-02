import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import MaintenanceForm from '@/components/maintenance-form';
import JsonLd from '@/components/json-ld';
import { pageOpenGraph } from '@/lib/site';
import { breadcrumbNode, graph, webPageNode } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Vedlikehold av maritim leider – video og registrering',
  description:
    'Se hvordan du vedlikeholder Argostep livbåtleideren, og registrer utført vedlikehold for ditt fartøy. Modulært system: bytt enkelttrinn i stedet for hele leideren.',
  alternates: { canonical: '/vedlikehold' },
  openGraph: pageOpenGraph({
    path: '/vedlikehold',
    title: 'Vedlikehold av maritim leider – video og registrering',
    description: 'Vedlikeholdsveiledning for Argostep og skjema for å registrere utført vedlikehold.',
  }),
};

// Bytt ut med riktig YouTube-video-ID for vedlikeholdsvideoen
const YOUTUBE_ID = 'dQw4w9WgXcQ';

export default function VedlikeholdPage() {
  return (
    <>
      <JsonLd
        data={graph([
          webPageNode({
            path: '/vedlikehold',
            name: 'Vedlikehold av Argostep maritim leider',
            description:
              'Vedlikeholdsveiledning for Argostep livbåtleider og registrering av utført vedlikehold.',
          }),
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'Vedlikehold', path: '/vedlikehold' },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Vedlikehold</div>
        <h1>Vedlikehold av leider</h1>
        <p>
          Se videoen som viser hvordan vedlikeholdet utføres, og registrer utført
          vedlikehold for ditt fartøy nederst på siden.
        </p>
      </div>

      <section className="mnt-section">
        <div className="mnt-wrap">
          <div className="mnt-video">
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_ID}`}
              title="Vedlikehold av Argostep livbåtleider"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>

          <MaintenanceForm />
        </div>
      </section>

      </main>

      <Footer />
    </>
  );
}
