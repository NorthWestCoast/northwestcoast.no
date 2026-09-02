import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import JsonLd from '@/components/json-ld';
import { ARTICLES, getArticle } from '@/lib/articles';
import { articleNode, breadcrumbNode, graph, isoDate, webPageNode } from '@/lib/structured-data';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

/**
 * Per-article metadata. Without this every article inherited the site-wide
 * title and description, so all of them competed for the same query and none
 * of them described their own content in a search result.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: 'Artikkel ikke funnet' };

  const url = `/nyheter/${article.slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: article.title,
      description: article.excerpt,
      publishedTime: isoDate(article.date),
      images: [{ url: article.image, alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [article.image],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <>
      <JsonLd
        data={graph([
          webPageNode({
            path: `/nyheter/${article.slug}`,
            name: article.title,
            description: article.excerpt,
          }),
          articleNode(article),
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'Nyheter', path: '/nyheter' },
            { name: article.title, path: `/nyheter/${article.slug}` },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <div className="article-hero">
        <div className="article-hero-img">
          <Image
            src={article.image}
            alt={article.title}
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            priority
          />
          <div className="article-hero-overlay" />
        </div>
        <div className="article-hero-content">
          <span className="news-tag">{article.tag}</span>
          <h1>{article.title}</h1>
          <p className="article-meta">
            <time dateTime={isoDate(article.date)}>{article.date}</time>
          </p>
        </div>
      </div>

      <section className="article-section">
        <article
          className="article-body"
          dangerouslySetInnerHTML={{ __html: article.body }}
        />
        <div className="article-footer">
          <Link href="/nyheter" className="news-link">← Tilbake til nyheter</Link>
        </div>
      </section>

      </main>

      <Footer />
    </>
  );
}
