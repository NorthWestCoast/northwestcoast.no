import JsonLd from '@/components/json-ld';
import { breadcrumbLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import OrderConfigurator from '@/components/order-configurator';
import { getDict, isLang, pageMetadata, DEFAULT_LANG } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'bestill', '/bestill');
}

export default async function BestillPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDict(l);

  return (
    <>
      <JsonLd data={[breadcrumbLd(l, [{ name: t.order.title, path: '/bestill' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.order.label}</div>
        <h1>{t.order.title}</h1>
        <p>{t.order.sub}</p>
      </div>

      <section className="config-section">
        <OrderConfigurator />
      </section>

      <Footer />
    </>
  );
}
