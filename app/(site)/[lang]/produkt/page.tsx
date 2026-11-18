import JsonLd from '@/components/json-ld';
import { breadcrumbLd, productLd } from '@/lib/seo';
import { getPriceTable } from '@/lib/catalog';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Features from '@/components/features';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';
import { DEFAULT_LANG, getDict, isLang, localePath, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'produkt', '/produkt');
}

export default async function ProduktPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = getDict(lang);
  const table = await getPriceTable();

  const specs = [
    t.product.specs.lengths,
    t.product.specs.material,
    t.product.specs.certification,
    t.product.specs.approval,
    t.product.specs.system,
    t.product.specs.maintenance,
  ];

  const vessels = [
    t.certs.vessels.fishing,
    t.certs.vessels.service,
    t.certs.vessels.cargo,
    t.certs.vessels.passenger,
  ];

  return (
    <>
      <JsonLd data={[productLd(lang, table), breadcrumbLd(lang, [{ name: t.product.title, path: '/produkt' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.product.label}</div>
        <h1>{t.product.title}</h1>
        <p>{t.product.sub}</p>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      {/* Produktoversikt */}
      <section className="product-intro">
        <div className="product-grid">
          <div className="product-img">
            <Image
              src="/images/ladder-full.png"
              alt={t.product.fullAlt}
              fill sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          <div>
            <div className="lbl lbl-dark">{t.product.introLabel}</div>
            <h2 className="stitle dark">{t.product.introTitle}</h2>
            <p className="sub dark" style={{ marginBottom: '0.5rem' }}>{t.product.introSub}</p>

            <div className="spec-list">
              {specs.map((s) => (
                <div className="spec-item" key={s.key}>
                  <span className="spec-key">{s.key}</span>
                  <span className="spec-val">{s.val}</span>
                </div>
              ))}
            </div>

            <div className="prod-actions">
              <Link href={localePath(lang, '/bestill')} className="btn-primary">
                {t.hero.ctaOrder}
              </Link>
              <a href="tel:+4790407341" className="btn-ghost">{t.product.call}</a>
            </div>
          </div>
        </div>
      </section>

      <section className="answers" aria-labelledby="answer-what">
        <div className="answers-grid">
          <div>
            <h2 id="answer-what">{t.product.answerTitle}</h2>
            <p>{t.product.answerBody}</p>
          </div>
          <div>
            <h2>{t.product.lengthTitle}</h2>
            <p>{t.product.lengthBody}</p>
            <Link href={localePath(lang, '/kalkulator')} className="news-link">
              {t.product.lengthCta}
            </Link>
          </div>
        </div>
      </section>

      <Features />

      <Wave top="var(--sand)" bottom="var(--navy-mid)" dual dualBottomFill="var(--navy-mid)" />

      {/* Tekniske detaljer + egnet for */}
      <section className="certs">
        <div className="certs-grid">
          <div>
            <div className="lbl">{t.product.fitLabel}</div>
            <h2 className="stitle">{t.product.fitTitle}</h2>
            <p className="sub" style={{ marginBottom: '1.5rem' }}>{t.product.fitSub}</p>

            <div className="lbl">{t.certs.vesselsLabel}</div>
            <div className="vessel-grid">
              {vessels.map((v) => (
                <div className="vessel" key={v}>{v}</div>
              ))}
            </div>

            <Link
              href={localePath(lang, '/bestill')}
              className="btn-primary"
              style={{ marginTop: '2rem', display: 'inline-flex' }}
            >
              {t.hero.ctaOrder}
            </Link>
          </div>

          <div className="cert-img">
            <Image
              src="/images/leider_in_use.jpg"
              alt={t.product.inUseAlt}
              fill sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* Bestillingsbånd */}
      <section className="order-band">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.product.bandLabel}</div>
        <h2>{t.product.bandTitle}</h2>
        <p>{t.product.bandSub}</p>
        <Link href={localePath(lang, '/bestill')} className="btn-primary" style={{ display: 'inline-flex' }}>
          {t.hero.ctaOrder}
        </Link>
      </section>

      <Footer />
      <Lightbox />
    </>
  );
}
