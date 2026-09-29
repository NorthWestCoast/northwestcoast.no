import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import LadderCalculator from '@/components/ladder-calculator';
import JsonLd from '@/components/json-ld';
import { graph } from '@/lib/structured-data';
import { ORG, SITE_URL } from '@/lib/site';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Leiderkalkulator – finn riktig lengde',
  description:
    'Regn ut hvilken Argostep livbåtleider fartøyet ditt trenger ut fra fribord og festepunkt – og bestill riktig lengde direkte.',
  path: '/kalkulator',
});

export default function KalkulatorPage() {
  return (
    <>
      <JsonLd
        data={graph({
          '@type': 'WebApplication',
          name: 'Leiderkalkulator',
          url: `${SITE_URL}/kalkulator`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Any',
          inLanguage: 'nb-NO',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: 0, priceCurrency: 'NOK' },
          provider: { '@id': `${SITE_URL}/#organization`, name: ORG.name },
        })}
      />
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Leiderkalkulator</div>
        <h1>Finn riktig leider for fartøyet</h1>
        <p>
          Legg inn målene fra fartøyet, så regner vi ut hvilken lengde du trenger – og du kan
          bestille riktig leider med én gang.
        </p>
      </div>

      <section className="calc-section">
        <LadderCalculator />
      </section>

      <Footer />
    </>
  );
}
