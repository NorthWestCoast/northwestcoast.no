import JsonLd from '@/components/json-ld';
import { breadcrumbLd, model3dLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Maximize2, Rotate3d, Smartphone, ZoomIn } from 'lucide-react';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Viewer3D from '@/components/viewer-3d';
import Footer from '@/components/footer';
import { DEFAULT_LANG, getDict, isLang, localePath, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'leider3d', '/3d-leider');
}

export default async function Leider3DPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = getDict(lang);
  const v = t.viewerPage;

  const hints = [
    { Icon: Rotate3d, ...v.hints.rotate },
    { Icon: ZoomIn, ...v.hints.zoom },
    { Icon: Maximize2, ...v.hints.fullscreen },
    { Icon: Smartphone, ...v.hints.ar },
  ];

  const specs = [
    v.specs.stepWeight,
    v.specs.width,
    t.product.specs.lengths,
    t.product.specs.material,
    t.product.specs.certification,
    t.product.specs.approval,
  ];

  return (
    <>
      <JsonLd
        data={[
          model3dLd(lang),
          breadcrumbLd(lang, [
            { name: t.products.navLabel, path: '/produkter' },
            { name: v.navLabel, path: '/3d-leider' },
          ]),
        ]}
      />

      <Nav />

      <div className="subpage-header subpage-header-tight">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{v.label}</div>
        <h1>{v.title}</h1>
        <p>{v.sub}</p>
      </div>

      {/* Samme visning som på forsiden – her får den mer plass. */}
      <div className="viewer-page">
        <Viewer3D />
      </div>

      <Wave top="var(--navy)" bottom="var(--navy-mid)" dual dualBottomFill="var(--navy-mid)" />

      {/* Slik bruker du modellen */}
      <section className="hints" aria-labelledby="viewer-how">
        <div className="section-inner">
          <div className="lbl">{v.howLabel}</div>
          <h2 className="stitle" id="viewer-how">{v.howTitle}</h2>
          <ul className="hint-grid">
            {hints.map(({ Icon, title, desc }) => (
              <li className="hint-card" key={title}>
                <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Wave top="var(--navy-mid)" bottom="var(--sand-light)" dual dualBottomFill="var(--sand-light)" />

      {/* Spesifikasjoner */}
      <section className="product-intro" aria-labelledby="viewer-specs">
        <div className="product-grid">
          <div>
            <div className="lbl lbl-dark">{v.specsLabel}</div>
            <h2 className="stitle dark" id="viewer-specs">{v.specsTitle}</h2>
            <p className="sub dark">{v.specsSub}</p>
            <p className="lead-note">
              <strong>{v.modularTitle}:</strong> {v.modularBody}
            </p>
            <div className="prod-actions">
              <Link href={localePath(lang, '/produkt')} className="btn-primary">
                {t.products.ladder.more}
              </Link>
              <Link href={localePath(lang, '/produkter')} className="btn-ghost">
                {t.products.overview}
              </Link>
            </div>
          </div>

          <div className="spec-list" style={{ margin: 0 }}>
            {specs.map((s) => (
              <div className="spec-item" key={s.key}>
                <span className="spec-key">{s.key}</span>
                <span className="spec-val">{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      {/* Bestillingsbånd */}
      <section className="order-band">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.product.bandLabel}</div>
        <h2>{t.product.bandTitle}</h2>
        <p>{t.product.bandSub}</p>
        <div className="band-actions">
          <Link
            href={localePath(lang, '/bestill')}
            className="btn-primary plausible-event-name=CTA:+Bestill plausible-event-source=3d-leider"
          >
            {t.hero.ctaOrder}
          </Link>
          <Link href={localePath(lang, '/kalkulator')} className="btn-ghost">
            {t.product.lengthCta}
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
