import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Min side',
  robots: { index: false, follow: false },
};

// Sesjonen leses per request; siden kan ikke prerenderes.
export const dynamic = 'force-dynamic';

/**
 * Foreløpig landingsside for Min side.
 *
 * Fase 0 bygger ikke dashboardet (det er fase 2) – men denne siden beviser at
 * hele kjeden virker: magic link → sesjonscookie → server-komponent → RLS.
 * Tallene under er hentet UTEN noe where-ledd; at de er riktige er nettopp
 * fordi RLS filtrerer.
 */
export default async function MinSidePage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ count: companies }, { count: vessels }, { count: ladders }] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('vessels').select('*', { count: 'exact', head: true }),
    supabase.from('ladders').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Min side</div>
        <h1>Oversikt</h1>
        <p>Innlogget som {user?.email}</p>
      </div>

      <section className="minside-section">
        <div className="minside-stats">
          <div className="minside-stat">
            <span className="minside-stat-num">{companies ?? 0}</span>
            <span className="minside-stat-label">Selskap</span>
          </div>
          <div className="minside-stat">
            <span className="minside-stat-num">{vessels ?? 0}</span>
            <span className="minside-stat-label">Fartøy</span>
          </div>
          <div className="minside-stat">
            <span className="minside-stat-num">{ladders ?? 0}</span>
            <span className="minside-stat-label">Leidere</span>
          </div>
        </div>

        <div className="minside-note">
          <h2>Dashboardet er under utvikling</h2>
          <p>
            Her kommer fartøyene dine med leidere, servicehistorikk, neste
            servicedato og vedlikeholdslogg – og mulighet til å dele leiderens
            tilstand med losen før ombordstigning.
          </p>
          <p>
            Er noe av dette feil, eller mangler fartøyet ditt?{' '}
            <Link href="/#kontakt">Si fra</Link>, så retter vi det.
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}
