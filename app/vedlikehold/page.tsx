import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import MaintenanceForm from '@/components/maintenance-form';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Vedlikehold av leider',
  description:
    'Se hvordan du vedlikeholder Argostep livbåtleideren og registrer utført vedlikehold for ditt fartøy – med kvittering på e-post som dokumentasjon.',
  path: '/vedlikehold',
});

/**
 * Vedlikeholdsvideoen settes med NEXT_PUBLIC_MAINTENANCE_VIDEO_ID.
 * Er den ikke satt viser vi en tydelig plassholder i stedet for å bygge inn
 * feil video – her sto det tidligere en placeholder-ID som pekte på en helt
 * annen video enn vedlikeholdsguiden.
 *
 * youtube-nocookie.com brukes så embedden ikke setter sporingscookies før
 * brukeren faktisk spiller av – da slipper siden en samtykkebanner.
 */
const YOUTUBE_ID = process.env.NEXT_PUBLIC_MAINTENANCE_VIDEO_ID;

export default function VedlikeholdPage() {
  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Vedlikehold</div>
        <h1>Vedlikehold av leider</h1>
        <p>
          Registrer utført vedlikehold for ditt fartøy – så får du en kvittering på
          e-post som dokumentasjon ved tilsyn.
        </p>
      </div>

      <section className="mnt-section">
        <div className="mnt-wrap">
          {YOUTUBE_ID ? (
            <div className="mnt-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}`}
                title="Vedlikehold av Argostep livbåtleider"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="mnt-video-placeholder">
              <span aria-hidden="true">🎬</span>
              <h2>Vedlikeholdsvideoen kommer snart</h2>
              <p>
                Trenger du veiledning nå? Ring{' '}
                <a href="tel:+4790407341">+47 904 07 341</a> eller send en e-post til{' '}
                <a href="mailto:arve@astep.no">arve@astep.no</a>, så hjelper vi deg.
              </p>
            </div>
          )}

          <MaintenanceForm />
        </div>
      </section>

      <Footer />
    </>
  );
}
