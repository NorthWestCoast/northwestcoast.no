import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';

/**
 * Custom 404.
 *
 * Two reasons this exists beyond politeness: it returns a real 404 with useful
 * internal links instead of a dead end (a crawler that lands on a stale URL
 * still finds its way back into the site), and `robots: { index: false }` keeps
 * the error page itself out of the index.
 */
export const metadata: Metadata = {
  title: 'Siden finnes ikke',
  description: 'Siden du leter etter finnes ikke. Finn fram til produkt, kalkulator eller kontakt.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <Nav />

      <main id="hovedinnhold">
        <div className="subpage-header">
          <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>404</div>
          <h1>Siden finnes ikke</h1>
          <p>
            Lenken kan være utdatert eller feilskrevet. Her er de mest brukte sidene i stedet.
          </p>
        </div>

        <section className="calc-faq" style={{ paddingTop: '2rem' }}>
          <div className="calc-cta" style={{ maxWidth: '760px', margin: '0 auto' }}>
            <h2>Kom videre</h2>
            <p>Velg en av snarveiene under, eller ring oss så hjelper vi deg direkte.</p>
            <div className="calc-cta-actions">
              <Link href="/produkt" className="btn-primary">Se produktet →</Link>
              <Link href="/leiderkalkulator" className="btn-ghost">Leiderkalkulator →</Link>
              <Link href="/bestill" className="btn-ghost">Bestill →</Link>
              <Link href="/faq" className="btn-ghost">Ofte stilte spørsmål →</Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
