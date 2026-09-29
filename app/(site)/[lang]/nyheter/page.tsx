import JsonLd from '@/components/json-ld';
import { breadcrumbLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { ARTICLES, localizeArticle } from '@/lib/articles';
import { DEFAULT_LANG, getDict, isLang, localePath, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'nyheter', '/nyheter');
}

export default async function NyheterPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = getDict(lang);
  const articles = ARTICLES.map((a) => localizeArticle(a, lang));

  return (
    <>
      <JsonLd data={[breadcrumbLd(lang, [{ name: t.nav.nyheter, path: '/nyheter' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.news.pageLabel}</div>
        <h1>{t.news.pageTitle}</h1>
        <p>{t.news.sub}</p>
      </div>

      <section className="nyheter-section">
        <div className="nyheter-grid">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={localePath(lang, `/nyheter/${article.slug}`)}
              className="nyheter-card"
            >
              <div className="nyheter-card-img">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill sizes="(max-width: 960px) 100vw, 50vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="nyheter-card-body">
                <div className="nyheter-card-meta">
                  <span className="news-tag">{article.tag}</span>
                  <span className="nyheter-card-date">{article.date}</span>
                </div>
                <h2>{article.title}</h2>
                <p>{article.excerpt}</p>
                <span className="news-link">{t.news.readMore}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
