import JsonLd from '@/components/json-ld';
import { articleLd, breadcrumbLd } from '@/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { ARTICLES, getArticle, localizeArticle } from '@/lib/articles';
import {
  DEFAULT_LANG,
  buildAlternates,
  getDict,
  isLang,
  localePath,
  SITE_URL,
} from '@/lib/i18n';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const found = getArticle(slug);
  if (!found) return {};
  const article = localizeArticle(found, lang);
  const path = `/nyheter/${slug}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${article.title} | NorthWest Coast`,
    description: article.excerpt,
    alternates: {
      ...buildAlternates(path),
      canonical: `${SITE_URL}${localePath(lang, path)}`,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.image],
      locale: getDict(lang).ogLocale,
      type: 'article',
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: raw, slug } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = getDict(lang);
  const found = getArticle(slug);
  if (!found) notFound();
  const article = localizeArticle(found, lang);

  return (
    <>
      <JsonLd
        data={[
          articleLd(lang, slug),
          breadcrumbLd(lang, [
            { name: t.nav.nyheter, path: '/nyheter' },
            { name: article.title, path: `/nyheter/${slug}` },
          ]),
        ]}
      />

      <Nav />

      <div className="article-hero">
        <div className="article-hero-img">
          <Image src={article.image} alt={article.title} fill sizes="100vw" style={{ objectFit: 'cover' }} priority />
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
          <Link href={localePath(lang, '/nyheter')} className="news-link">{t.news.back}</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
