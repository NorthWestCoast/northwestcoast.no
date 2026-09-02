import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';
import GalleryTabs from '@/components/gallery-tabs';
import JsonLd from '@/components/json-ld';
import { ALL_IMAGES } from '@/lib/gallery';
import { abs, pageOpenGraph } from '@/lib/site';
import { breadcrumbNode, graph, webPageNode, ORG_ID } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Bildegalleri – Argostep maritim leider i bruk',
  description:
    'Se Argostep-leideren fra alle vinkler: produktbilder, oppbevaringsskap og leideren i daglig bruk om bord på fartøy langs norskekysten.',
  alternates: { canonical: '/galleri' },
  openGraph: pageOpenGraph({
    path: '/galleri',
    title: 'Bildegalleri – Argostep maritim leider i bruk',
    description: 'Produktbilder, oppbevaringsskap og referansefartøy langs norskekysten.',
  }),
};

export default function GalleriPage() {
  return (
    <>
      {/* ImageGallery schema with every image described: image search and
          multimodal AI models both index the captions, not the pixels. */}
      <JsonLd
        data={graph([
          {
            ...webPageNode({
              path: '/galleri',
              name: 'Bildegalleri – Argostep i bruk',
              description: 'Bilder av Argostep maritim leider, oppbevaringsskap og referansefartøy.',
              type: 'ImageGallery',
            }),
            image: ALL_IMAGES.map((img) => ({
              '@type': 'ImageObject',
              contentUrl: abs(img.src),
              name: img.label,
              description: img.alt,
              creditText: 'NorthWest Coast',
              copyrightNotice: 'Northwestcoast AS',
              creator: { '@id': ORG_ID },
            })),
          },
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'Galleri', path: '/galleri' },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Produktgalleri</div>
        <h1>Argostep i bilder</h1>
        <p>Fra produkt til praksis – se leideren fra alle vinkler og i daglig bruk langs norskekysten.</p>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      <GalleryTabs />

      <Wave top="var(--sand-light)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      </main>

      <Footer />
      <Lightbox />
    </>
  );
}
