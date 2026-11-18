import JsonLd from '@/components/json-ld';
import { breadcrumbLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';
import GalleryPage from '@/components/gallery-page';
import { DEFAULT_LANG, getDict, isLang, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'galleri', '/galleri');
}

export default async function GalleriPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDict(l);

  return (
    <>
      <JsonLd data={[breadcrumbLd(l, [{ name: t.nav.galleri, path: '/galleri' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.gallery.label}</div>
        <h1>{t.gallery.title}</h1>
        <p>{t.gallery.pageSub}</p>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      <GalleryPage />

      <Wave top="var(--sand-light)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      <Footer />
      <Lightbox />
    </>
  );
}
