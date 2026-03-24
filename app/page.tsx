import Nav from '@/components/nav';
import Hero from '@/components/hero';
import Features from '@/components/features';
import Wave from '@/components/wave';
import HowItWorks from '@/components/how-it-works';
import Gallery from '@/components/gallery';
import Viewer3D from '@/components/viewer-3d';
import Certifications from '@/components/certifications';
import InUse from '@/components/in-use';
import Testimonials from '@/components/testimonials';
import News from '@/components/news';
import Faq from '@/components/faq';
import Contact from '@/components/contact';
import Newsletter from '@/components/newsletter';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';

export default function HomePage() {
  return (
    <>
      <Nav />

      <Hero />

      {/* Sand wave down */}
      <Wave
        top="var(--navy)"
        bottom="var(--sand)"
        path="M0,40 C480,80 960,10 1440,50 L1440,70 L0,70Z"
      />

      <Features />

      {/* Navy-mid wave */}
      <Wave
        topPath="M0,30 C360,-5 720,65 1080,20 C1260,5 1380,55 1440,30 L1440,70 L0,70Z"
        top="var(--sand)"
        bottom="var(--navy-mid)"
        dual
        dualBottomFill="var(--navy-mid)"
        dualTopFill="var(--sand)"
      />

      <HowItWorks />

      {/* Sand-light wave */}
      <Wave
        topPath="M0,35 C480,80 960,0 1440,45 L1440,70 L0,70Z"
        top="var(--navy-mid)"
        bottom="var(--sand-light)"
        dual
        dualBottomFill="var(--sand-light)"
        dualTopFill="var(--navy-mid)"
      />

      <Gallery />

      {/* Navy wave */}
      <Wave
        topPath="M0,20 C360,70 720,0 1080,50 C1260,70 1380,20 1440,30 L1440,70 L0,70Z"
        top="var(--sand-light)"
        bottom="var(--navy)"
        dual
        dualBottomFill="var(--navy)"
        dualTopFill="var(--sand-light)"
      />

      <Viewer3D />

      {/* Navy-mid wave */}
      <Wave
        topPath="M0,40 C480,10 960,70 1440,25 L1440,70 L0,70Z"
        top="var(--navy)"
        bottom="var(--navy-mid)"
        dual
        dualBottomFill="var(--navy-mid)"
        dualTopFill="var(--navy)"
      />

      <Certifications />

      {/* Sand wave */}
      <Wave
        topPath="M0,25 C360,70 720,5 1080,55 C1260,75 1380,25 1440,35 L1440,70 L0,70Z"
        top="var(--navy-mid)"
        bottom="var(--sand)"
        dual
        dualBottomFill="var(--sand)"
        dualTopFill="var(--navy-mid)"
      />

      <InUse />

      {/* Navy wave */}
      <Wave
        topPath="M0,35 C360,5 720,70 1080,20 C1260,0 1380,55 1440,35 L1440,70 L0,70Z"
        top="var(--sand)"
        bottom="var(--navy)"
        dual
        dualBottomFill="var(--navy)"
        dualTopFill="var(--sand)"
      />

      <Testimonials />

      {/* Sand-light wave */}
      <Wave
        topPath="M0,40 C480,5 960,75 1440,30 L1440,70 L0,70Z"
        top="var(--navy)"
        bottom="var(--sand-light)"
        dual
        dualBottomFill="var(--sand-light)"
        dualTopFill="var(--navy)"
      />

      <News />

      {/* Navy wave */}
      <Wave
        topPath="M0,30 C360,70 720,0 1080,50 C1300,80 1380,20 1440,40 L1440,70 L0,70Z"
        top="var(--sand-light)"
        bottom="var(--navy)"
        dual
        dualBottomFill="var(--navy)"
        dualTopFill="var(--sand-light)"
      />

      <Faq />

      <Contact />

      <Newsletter />

      <Footer />

      <Lightbox />
    </>
  );
}
