import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import JsonLd from '@/components/json-ld';
import { ARTICLES } from '@/lib/articles';
import { abs, pageOpenGraph } from '@/lib/site';
import { breadcrumbNode, graph, isoDate, webPageNode } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Nyheter om maritime leidere og sikkerhet til sjøs',
  description:
    'Nyheter, produktoppdateringer og caser fra NorthWest Coast – om maritime leidere, oppbevaringsløsninger og sikker ombordstigning på norske fartøy.',
  alternates: { canonical: '/nyheter' },
  openGraph: pageOpenGraph({
    path: '/nyheter',
    title: 'Nyheter om maritime leidere og sikkerhet til sjøs',
    description: 'Nyheter, produktoppdateringer og caser fra NorthWest Coast.',
  }),
};

export default function NyheterPage() {
  return (
    <>
      {/* A CollectionPage listing the articles in order gives crawlers the whole
          archive from one URL, even before they follow a single link. */}
      <JsonLd
        data={graph([
          {
            ...webPageNode({
              path: '/nyheter',
              name: 'Nyheter fra NorthWest Coast',
              description: 'Nyheter, produktoppdateringer og caser om maritime leidere.',
              type: 'CollectionPage',
            }),
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: ARTICLES.map((article, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: abs(`/nyheter/${article.slug}`),
                name: article.title,
              })),
            },
          },
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'Nyheter', path: '/nyheter' },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Fra bloggen</div>
        <h1>Siste nytt om maritime leidere</h1>
        <p>Hold deg oppdatert med nyheter, caser og forskrifter for maritime leidere.</p>
      </div>

      <section className="nyheter-section">
        <div className="nyheter-grid">
          {ARTICLES.map((article, i) => (
            <Link key={article.slug} href={`/nyheter/${article.slug}`} className="nyheter-card">
              <div className="nyheter-card-img">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  priority={i === 0}
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="nyheter-card-body">
                <div className="nyheter-card-meta">
                  <span className="news-tag">{article.tag}</span>
                  <time className="nyheter-card-date" dateTime={isoDate(article.date)}>
                    {article.date}
                  </time>
                </div>
                <h2>{article.title}</h2>
                <p>{article.excerpt}</p>
                <span className="news-link">Les mer →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      </main>

      <Footer />
    </>
  );
}
