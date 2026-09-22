import type { Metadata } from 'next';
import { Suspense } from 'react';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import LoginForm from '@/components/login-form';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Logg inn',
    description: 'Logg inn på Min side for å se fartøy, leidere, service og vedlikeholdslogg.',
    path: '/logg-inn',
  }),
  // Innloggingssiden skal ikke indekseres.
  robots: { index: false, follow: false },
};

export default function LoggInnPage() {
  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Min side</div>
        <h1>Logg inn</h1>
        <p>
          Vi sender deg en innloggingslenke på e-post. Ingen passord å huske.
        </p>
      </div>

      <section className="auth-section">
        {/* useSearchParams() leser ?neste og ?feil, som kun finnes ved
            kjoretid. Suspense lar resten av siden prerendres statisk. */}
        <Suspense fallback={<div className="auth-card"><p>Laster…</p></div>}>
          <LoginForm />
        </Suspense>
      </section>

      <Footer />
    </>
  );
}
