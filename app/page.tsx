import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Hero from '@/components/hero';
import Features from '@/components/features';
import Wave from '@/components/wave';
import HowItWorks from '@/components/how-it-works';
import MediaGallery from '@/components/media-gallery';
import Viewer3D from '@/components/viewer-3d';
import Certifications from '@/components/certifications';
import Testimonials from '@/components/testimonials';
import News from '@/components/news';
import Faq from '@/components/faq';
import Contact from '@/components/contact';
import Newsletter from '@/components/newsletter';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';
import JsonLd from '@/components/json-ld';
import { FAQS } from '@/lib/faqs';
import { faqNode, graph, productNode, webPageNode } from '@/lib/structured-data';

export const metadata: Metadata = {
  // The front page is the one URL most likely to be cited as "the" source for
  // the brand, so its title leads with the product entity rather than the
  // company name, and its canonical is explicit.
  title: {
    absolute: 'Argostep maritim leider – lett, modulær og sertifisert | NorthWest Coast',
  },
  description:
    'Argostep er en lett, modulær maritim leider i glassfiberarmert plast, sertifisert etter ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet. Standardlengder 2–15 meter. Produsert på Sunnmøre.',
  alternates: { canonical: '/' },
};

// Home page component
export default function HomePage() {
  return (
    <>
      {/* The front page carries the Product entity and the FAQ answers: these
          are the two things an answer engine needs to say what Argostep is and
          respond to the questions people actually ask about it. */}
      <JsonLd
        data={graph([
          webPageNode({
            path: '/',
            name: 'Argostep maritim leider',
            description:
              'Argostep – lett, modulær maritim leider i glassfiberarmert plast. ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet.',
          }),
          productNode(),
          // Only the four questions actually rendered on this page. Structured
          // data must describe visible content; the full set lives on /faq.
          faqNode(FAQS.slice(0, 4), '/'),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <Hero />

      {/* Sand wave — overlaps into hero, no own background */}
      <Wave
        bottom="var(--sand)"
        overlap
      />

      <Features />

      {/* Navy-mid wave */}
      <Wave
        top="var(--sand)"
        bottom="var(--navy-mid)"
        dual
        dualBottomFill="var(--navy-mid)"
      />

      <HowItWorks />

      {/* Sand-light wave */}
      <Wave
        top="var(--navy-mid)"
        bottom="var(--sand-light)"
        dual
        dualBottomFill="var(--sand-light)"
      />

      <MediaGallery />

      {/* Navy wave */}
      <Wave
        top="var(--sand-light)"
        bottom="var(--navy)"
        dual
        dualBottomFill="var(--navy)"
      />

      <Viewer3D />

      {/* Navy-mid wave */}
      <Wave
        top="var(--navy)"
        bottom="var(--navy-mid)"
        dual
        dualBottomFill="var(--navy-mid)"
      />

      <Certifications />

      {/* Navy wave */}
      <Wave
        top="var(--navy-mid)"
        bottom="var(--navy)"
        dual
        dualBottomFill="var(--navy)"
      />

      <Testimonials />

      {/* Sand-light wave */}
      <Wave
        top="var(--navy)"
        bottom="var(--sand-light)"
        dual
        dualBottomFill="var(--sand-light)"
      />

      <News />

      {/* Navy wave */}
      <Wave
        top="var(--sand-light)"
        bottom="var(--navy)"
        dual
        dualBottomFill="var(--navy)"
      />

      <Faq />

      <Contact />

      <Newsletter />

      </main>

      <Footer />

      <Lightbox />
    </>
  );
}
