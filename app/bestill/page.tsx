import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import OrderConfigurator from '@/components/order-configurator';

export const metadata: Metadata = {
  title: 'Bestill Argostep Livbåtleider | NorthWest Coast',
  description:
    'Bestill din Argostep Livbåtleider. Velg lengde mellom 3 og 15 meter og tilbehør – og se leideren i 3D mens du konfigurerer.',
};

export default function BestillPage() {
  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Bestilling</div>
        <h1>Bestill din Argostep</h1>
        <p>
          Sett sammen leideren for ditt fartøy. Velg lengde mellom 3 og 15 meter og
          tilbehør – se den i 3D mens du konfigurerer.
        </p>
      </div>

      <section className="config-section">
        <OrderConfigurator />
      </section>

      <Footer />
    </>
  );
}
