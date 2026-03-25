import Image from 'next/image';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { ARTICLES } from '@/lib/articles';

export default function NyheterPage() {
  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Fra bloggen</div>
        <h1>Siste nytt</h1>
        <p>Hold deg oppdatert med nyheter, caser og forskrifter for maritime leidere.</p>
      </div>

      <section className="nyheter-section">
        <div className="nyheter-grid">
          {ARTICLES.map((article) => (
            <a key={article.slug} href={`/nyheter/${article.slug}`} className="nyheter-card">
              <div className="nyheter-card-img">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
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
                <span className="news-link">Les mer →</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
