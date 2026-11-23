import JsonLd from '@/components/json-ld';
import { breadcrumbLd, faqLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import FaqPageContent from '@/components/faq-page';
import { DEFAULT_LANG, getDict, isLang, pageMetadata } from '@/lib/i18n';
import { getFaq } from '@/lib/faq';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'faq', '/faq');
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDict(l);
  const faq = await getFaq(l);

  return (
    <>
      <JsonLd
        data={[
          ...(faq.length ? [faqLd(l, faq)] : []),
          breadcrumbLd(l, [{ name: t.nav.faq, path: '/faq' }]),
        ]}
      />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.faq.pageLabel}</div>
        <h1>{t.faq.title}</h1>
        <p>{t.faq.pageSub}</p>
      </div>

      <FaqPageContent items={faq} />

      <Footer />
    </>
  );
}
