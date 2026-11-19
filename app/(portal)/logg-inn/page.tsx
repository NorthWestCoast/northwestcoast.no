import type { Metadata } from 'next';
import { Suspense } from 'react';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import LoginForm from '@/components/login-form';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Logg inn eller opprett konto',
    description: 'Logg inn eller opprett konto på Min side for å registrere selskapet ditt og følge opp leidere, service og vedlikeholdslogg.',
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
        <h1>Logg inn eller opprett konto</h1>
        <p>
          Vi sender deg en lenke på e-post. Er du ny, får du en konto
          automatisk med den første lenken. Ingen passord å huske.
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
