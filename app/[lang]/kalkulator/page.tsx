import JsonLd from '@/components/json-ld';
import { breadcrumbLd, calculatorLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import LadderCalculator from '@/components/ladder-calculator';
import { DEFAULT_LANG, getDict, isLang, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'kalkulator', '/kalkulator');
}

export default async function KalkulatorPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDict(l);

  return (
    <>
      <JsonLd data={[calculatorLd(l), breadcrumbLd(l, [{ name: t.calculator.label, path: '/kalkulator' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.calculator.label}</div>
        <h1>{t.calculator.title}</h1>
        <p>{t.calculator.sub}</p>
      </div>

      <section className="calc-section">
        <LadderCalculator />
      </section>

      <Footer />
    </>
  );
}
