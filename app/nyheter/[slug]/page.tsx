import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import JsonLd from '@/components/json-ld';
import { ARTICLES, getArticle } from '@/lib/articles';
import { SITE_URL } from '@/lib/site';
import { graph, organizationSchema } from '@/lib/structured-data';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

/** Datoene i artiklene er DD.MM.YYYY – Schema.org og OG vil ha ISO-8601. */
function isoDate(date: string): string {
  const [day, month, year] = date.split('.').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: 'Artikkel ikke funnet' };

  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/nyheter/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.excerpt,
      url: `/nyheter/${article.slug}`,
      publishedTime: isoDate(article.date),
      images: [{ url: article.image, alt: article.title }],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const articleSchema = {
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: `${SITE_URL}${article.image}`,
    datePublished: isoDate(article.date),
    inLanguage: 'nb-NO',
    mainEntityOfPage: `${SITE_URL}/nyheter/${article.slug}`,
    author: { '@id': organizationSchema['@id'] },
    publisher: { '@id': organizationSchema['@id'] },
  };

  return (
    <>
      <JsonLd data={graph(organizationSchema, articleSchema)} />

      <Nav />

      <div className="article-hero">
        <div className="article-hero-img">
          <Image src={article.image} alt={article.title} fill style={{ objectFit: 'cover' }} priority />
          <div className="article-hero-overlay" />
        </div>
        <div className="article-hero-content">
          <span className="news-tag">{article.tag}</span>
          <h1>{article.title}</h1>
          <p className="article-meta">{article.date}</p>
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

      <Footer />
    </>
  );
}
