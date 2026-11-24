import JsonLd from '@/components/json-ld';
import { faqLd, productLd } from '@/lib/seo';
import { getPriceTable } from '@/lib/catalog';
import { getGalleryImages } from '@/lib/gallery';
import { FAQ_FRONT_PAGE, getFaq } from '@/lib/faq';
import { DEFAULT_LANG, isLang } from '@/lib/i18n';
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

// Home page component
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const [table, gallery, faq] = await Promise.all([getPriceTable(), getGalleryImages(lang), getFaq(lang)]);

  return (
    <>
      <JsonLd data={[productLd(lang, table), ...(faq.length ? [faqLd(lang, faq.slice(0, FAQ_FRONT_PAGE))] : [])]} />
      <Nav />

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

      <MediaGallery images={gallery} />

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

      {faq.length > 0 && <Faq items={faq} />}

      <Contact />

      <Newsletter />

      <Footer />

      <Lightbox />
    </>
  );
}
