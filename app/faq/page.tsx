import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import FaqSearch from '@/components/faq-search';
import JsonLd from '@/components/json-ld';
import { FAQS } from '@/lib/faqs';
import { pageOpenGraph } from '@/lib/site';
import { breadcrumbNode, faqNode, graph, webPageNode } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Ofte stilte spørsmål om Argostep maritim leider',
  description:
    'Svar på de vanligste spørsmålene om Argostep: godkjenning etter ISO 799-1:2019, tilgjengelige lengder, materialvalg, montering, levetid, reservedeler og leveringstid.',
  alternates: { canonical: '/faq' },
  openGraph: pageOpenGraph({
    path: '/faq',
    title: 'Ofte stilte spørsmål om Argostep maritim leider',
    description:
      'Godkjenning, lengder, materialvalg, montering, levetid, reservedeler og leveringstid – samlet på én side.',
  }),
};

export default function FaqPage() {
  return (
    <>
      {/* One FAQPage node, not two: the page entity and the Q&A list are merged
          so the page itself IS the FAQPage — that is the shape Google expects,
          and it is what makes these answers eligible to be lifted into results
          and quoted by AI assistants, question by question. */}
      <JsonLd
        data={graph([
          {
            ...webPageNode({
              path: '/faq',
              name: 'Ofte stilte spørsmål om Argostep',
              description: 'Svar på de vanligste spørsmålene om Argostep maritim leider.',
              type: 'FAQPage',
            }),
            mainEntity: faqNode(FAQS, '/faq').mainEntity,
          },
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Hjelp &amp; Support</div>
        <h1>Ofte stilte spørsmål om Argostep</h1>
        <p>Finn svar på de vanligste spørsmålene om Argostep maritim leider.</p>
      </div>

      <FaqSearch />

      </main>

      <Footer />
    </>
  );
}
