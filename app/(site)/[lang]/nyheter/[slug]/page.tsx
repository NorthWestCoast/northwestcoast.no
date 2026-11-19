import JsonLd from '@/components/json-ld';
import { articleLd, breadcrumbLd } from '@/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import PostBody from '@/components/post-body';
import { canOptimizeImage } from '@/lib/articles';
import { getArticle, getArticles } from '@/lib/posts';
import {
  DEFAULT_LANG,
  buildAlternates,
  getDict,
  isLang,
  localePath,
  SITE_URL,
} from '@/lib/i18n';

/**
 * Innleggene som finnes når nettstedet bygges, forhåndsgenereres. Et innlegg
 * som publiseres i admin etterpå finnes ikke i den lista: da tegnes siden
 * første gang noen åpner den (dynamicParams), og mellomlagres deretter.
 * Endringer slår inn når admin kaller revalidateTag(POSTS_TAG), senest etter
 * en time.
 */
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const articles = await getArticles(DEFAULT_LANG);
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const article = await getArticle(slug, lang);
  if (!article) return {};
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
      url: `${SITE_URL}${localePath(lang, path)}`,
      siteName: 'NorthWest Coast',
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
  const article = await getArticle(slug, lang);
  if (!article) notFound();

  return (
    <>
      <JsonLd
        data={[
          articleLd(lang, article),
          breadcrumbLd(lang, [
            { name: t.nav.nyheter, path: '/nyheter' },
            { name: article.title, path: `/nyheter/${slug}` },
          ]),
        ]}
      />

      <Nav />

      <div className="article-hero">
        <div className="article-hero-img">
          <Image
            src={article.image}
            alt={article.title}
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            unoptimized={!canOptimizeImage(article.image)}
            priority
          />
          <div className="article-hero-overlay" />
        </div>
        <div className="article-hero-content">
          <span className="news-tag">{article.tag}</span>
          <h1>{article.title}</h1>
          <p className="article-meta">{article.date}</p>
        </div>
      </div>

      <section className="article-section">
        <article className="article-body">
          <PostBody body={article.body} />
        </article>
        <div className="article-footer">
          <Link href={localePath(lang, '/nyheter')} className="news-link">{t.news.back}</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
