import JsonLd from '@/components/json-ld';
import { breadcrumbLd, cabinetLd, productLd, productListLd } from '@/lib/seo';
import { getPriceTable } from '@/lib/catalog';
import { cabinetAvailable, fmt, type PriceTable } from '@/lib/pricing';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ClipboardCheck, User, Wrench } from 'lucide-react';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import { ORG, portalHref } from '@/lib/site';
import { DEFAULT_LANG, getDict, isLang, localePath, pageMetadata } from '@/lib/i18n';
import { RENDER_BG } from '@/lib/gallery-images';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'produkter', '/produkter');
}

type CabinetModel = { name: string; min: number; max: number; price: number; maxPrice: number };

/** Samler prislista til én rad per skapmodell, med leiderlengdene den passer til. */
function cabinetModels(table: PriceTable): CabinetModel[] {
  const byName = new Map<string, CabinetModel>();
  for (const row of table) {
    if (!cabinetAvailable(row)) continue;
    const model = byName.get(row.cabinetName);
    if (!model) {
      byName.set(row.cabinetName, {
        name: row.cabinetName,
        min: row.length,
        max: row.length,
        price: row.cabinetPrice,
        maxPrice: row.cabinetPrice,
      });
    } else {
      model.min = Math.min(model.min, row.length);
      model.max = Math.max(model.max, row.length);
      model.price = Math.min(model.price, row.cabinetPrice);
      model.maxPrice = Math.max(model.maxPrice, row.cabinetPrice);
    }
  }
  return [...byName.values()].sort((a, b) => a.min - b.min);
}

export default async function ProdukterPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = getDict(lang);
  const p = t.products;
  const table = await getPriceTable();

  const lengths = table.map((r) => r.length);
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);
  const cabinets = cabinetModels(table);
  const cabinet = cabinetLd(lang, table);
  const contactHref = `${localePath(lang, '/')}#kontakt`;

  return (
    <>
      <JsonLd
        data={[
          productLd(lang, table),
          ...(cabinet ? [cabinet] : []),
          productListLd(lang, table),
          breadcrumbLd(lang, [{ name: p.navLabel, path: '/produkter' }]),
        ]}
      />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{p.label}</div>
        <h1>{p.title}</h1>
        <p>{p.sub}</p>
        <div className="subpage-nav-links">
          <a href="#leidere" className="subpage-nav-link">{p.anchors.ladders}</a>
          <a href="#oppbevaring" className="subpage-nav-link">{p.anchors.storage}</a>
          <a href="#reservedeler" className="subpage-nav-link">{p.anchors.parts}</a>
        </div>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      {/* Leidere */}
      <section className="product-intro anchor-section" id="leidere" aria-labelledby="products-ladder">
        <div className="product-grid">
          <div className="product-img">
            <Image
              src="/images/argostep-utfelt.jpg"
              alt={t.product.fullAlt}
              fill sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'contain', background: RENDER_BG }}
              priority
            />
          </div>

          <div>
            <div className="lbl lbl-dark">{p.ladder.label}</div>
            <h2 className="stitle dark" id="products-ladder">{p.ladder.title}</h2>
            <p className="sub dark">{p.ladder.desc}</p>

            <ul className="check-list dark">
              {p.ladder.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <div className="prod-actions">
              <Link href={localePath(lang, '/produkt')} className="btn-primary">
                {p.ladder.more}
              </Link>
              <Link href={localePath(lang, '/3d-leider')} className="btn-ghost">
                {p.ladder.view3d}
              </Link>
            </div>
          </div>
        </div>

        {/* Lengder, trinn og priser – rett fra prislista */}
        <div className="range-wrap">
          <div className="range-intro">
            <div className="lbl lbl-dark">{p.range.label}</div>
            <h3 className="range-title">{p.range.title}</h3>
            <p className="sub dark">{p.range.sub(minLength, maxLength)}</p>
            <p className="range-note">{t.order.note}</p>
            <div className="prod-actions">
              <Link
                href={localePath(lang, '/bestill')}
                className="btn-primary plausible-event-name=CTA:+Bestill plausible-event-source=produkter"
              >
                {t.hero.ctaOrder}
              </Link>
              <Link href={localePath(lang, '/kalkulator')} className="btn-ghost">
                {t.product.lengthCta}
              </Link>
            </div>
          </div>

          <div className="data-table-box">
            <table className="data-table">
              <caption className="sr-only">{p.range.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.order.length}</th>
                  <th scope="col" className="num">{t.order.steps}</th>
                  <th scope="col" className="col-number">{t.order.productNo}</th>
                  <th scope="col" className="num">{p.range.price}</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.length}>
                    <th scope="row">{row.length} m</th>
                    <td className="num">{row.steps > 0 ? row.steps : '–'}</td>
                    <td className="mono col-number">{row.productNumber || '–'}</td>
                    <td className="num price">
                      {row.onRequest ? (
                        <span className="muted">{t.order.onRequest}</span>
                      ) : (
                        `${fmt(row.price)} kr`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy-mid)" dual dualBottomFill="var(--navy-mid)" />

      {/* Oppbevaring */}
      <section className="certs anchor-section" id="oppbevaring" aria-labelledby="products-storage">
        <div className="certs-grid storage-grid">
          <div>
            <div className="lbl">{p.storage.label}</div>
            <h2 className="stitle" id="products-storage">{p.storage.title}</h2>
            <p className="sub">{p.storage.desc}</p>

            <ul className="check-list">
              {p.storage.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            {cabinets.length > 0 && (
              <div className="data-table-box on-dark">
                <table className="data-table">
                  <caption className="sr-only">{p.storage.caption}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{p.storage.model}</th>
                      <th scope="col">{p.storage.fits}</th>
                      <th scope="col" className="num">{p.range.price}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cabinets.map((c) => (
                      <tr key={c.name}>
                        <th scope="row" className="mono">{c.name}</th>
                        <td>{p.storage.fitsRange(c.min, c.max)}</td>
                        <td className="num price">
                          {c.price !== c.maxPrice ? `${p.storage.from} ` : ''}
                          {fmt(c.price)} kr
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="cta-row">
              <Link
                href={localePath(lang, '/bestill')}
                className="btn-primary plausible-event-name=CTA:+Bestill plausible-event-source=produkter-skap"
              >
                {p.storage.order}
              </Link>
              <Link href={localePath(lang, '/galleri')} className="btn-ghost">
                {t.gallery.seeAll}
              </Link>
            </div>
          </div>

          <div className="photo-trio">
            <div className="photo-trio-item">
              <Image
                src="/images/leider_cabinet.jpg"
                alt={p.storage.alts.closed}
                fill sizes="(max-width: 960px) 60vw, 28vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="photo-trio-item">
              <Image
                src="/images/leider_cabinet2.jpg"
                alt={p.storage.alts.deck}
                fill sizes="(max-width: 960px) 40vw, 18vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="photo-trio-item">
              <Image
                src="/images/leider_folded.jpg"
                alt={p.storage.alts.open}
                fill sizes="(max-width: 960px) 40vw, 18vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </section>

      <Wave top="var(--navy-mid)" bottom="var(--sand-light)" dual dualBottomFill="var(--sand-light)" />

      {/* Reservedeler og service */}
      <section className="parts-section anchor-section" id="reservedeler" aria-labelledby="products-parts">
        <div className="section-inner">
          <div className="lbl lbl-dark">{p.parts.label}</div>
          <h2 className="stitle dark" id="products-parts">{p.parts.title}</h2>
          <p className="sub dark">{p.parts.sub}</p>

          <div className="info-cards">
            <div className="info-card">
              <Wrench className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h3>{p.parts.cards.parts.title}</h3>
              <p>{p.parts.cards.parts.desc}</p>
              <Link href={contactHref} className="news-link">{p.parts.cards.parts.cta}</Link>
            </div>
            <div className="info-card">
              <ClipboardCheck className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h3>{p.parts.cards.service.title}</h3>
              <p>{p.parts.cards.service.desc}</p>
              <Link href={localePath(lang, '/vedlikehold')} className="news-link">
                {p.parts.cards.service.cta}
              </Link>
            </div>
            <div className="info-card">
              <User className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h3>{p.parts.cards.customer.title}</h3>
              <p>{p.parts.cards.customer.desc}</p>
              {/* Min side finnes bare på norsk. */}
              <Link href={portalHref('/logg-inn')} className="news-link">{p.parts.cards.customer.cta}</Link>
            </div>
          </div>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      {/* Hjelp til å velge */}
      <section className="order-band">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.contact.label}</div>
        <h2>{p.help.title}</h2>
        <p>{p.help.sub}</p>
        <div className="band-actions">
          <Link href={contactHref} className="btn-primary">{p.help.cta}</Link>
          <a
            href={`tel:${ORG.phone}`}
            className="btn-ghost plausible-event-name=Lead:+Phone+click plausible-event-source=produkter"
          >
            {t.product.call}
          </a>
        </div>
      </section>

      <Footer />
    </>
  );
}
