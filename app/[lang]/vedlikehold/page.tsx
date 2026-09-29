import JsonLd from '@/components/json-ld';
import { breadcrumbLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import MaintenanceForm from '@/components/maintenance-form';
import { getDict, isLang, pageMetadata, DEFAULT_LANG } from '@/lib/i18n';

// Sett NEXT_PUBLIC_MAINTENANCE_VIDEO_ID til YouTube-ID-en for vedlikeholdsvideoen.
// Uten den viser vi en henvisning i stedet for en tilfeldig video.
const YOUTUBE_ID = process.env.NEXT_PUBLIC_MAINTENANCE_VIDEO_ID;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'vedlikehold', '/vedlikehold');
}

export default async function VedlikeholdPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDict(l);

  return (
    <>
      <JsonLd data={[breadcrumbLd(l, [{ name: t.maintenance.title, path: '/vedlikehold' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.maintenance.label}</div>
        <h1>{t.maintenance.title}</h1>
        <p>{t.maintenance.sub}</p>
      </div>

      <section className="mnt-section">
        <div className="mnt-wrap">
          {YOUTUBE_ID ? (
            <div className="mnt-video">
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_ID}`}
                title={t.maintenance.videoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="mnt-video mnt-video-empty">
              <h2>{t.maintenance.videoSoon}</h2>
              <p>
                {t.maintenance.videoFallback}{' '}
                <a href="tel:+4790407341">+47 904 07 341</a>{' '}
                {t.maintenance.videoFallbackMid}{' '}
                <a href="mailto:arve@astep.no">arve@astep.no</a>{' '}
                {t.maintenance.videoFallbackEnd}
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
