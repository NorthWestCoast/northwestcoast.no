import { notFound } from 'next/navigation';
import Image from 'next/image';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { ARTICLES, getArticle } from '@/lib/articles';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <>
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
          <a href="/nyheter" className="news-link">← Tilbake til nyheter</a>
        </div>
      </section>

      <Footer />
    </>
  );
}
