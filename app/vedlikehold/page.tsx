import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import MaintenanceForm from '@/components/maintenance-form';

export const metadata: Metadata = {
  title: 'Vedlikehold av leider | NorthWest Coast',
  description:
    'Se hvordan du vedlikeholder Argostep livbåtleideren og registrer utført vedlikehold for ditt fartøy.',
};

// Bytt ut med riktig YouTube-video-ID for vedlikeholdsvideoen
const YOUTUBE_ID = 'dQw4w9WgXcQ';

export default function VedlikeholdPage() {
  return (
    <>
      <Nav />

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

      <Footer />
    </>
  );
}
