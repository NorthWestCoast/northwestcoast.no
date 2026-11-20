import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { confirmLink } from './actions';

export const metadata: Metadata = {
  title: 'Bekreft innlogging',
  // Adressen inneholder en engangsnøkkel: ikke i søk, og ikke videre i
  // Referer-hodet til andre nettsteder.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const TYPES = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

/**
 * Siden lenken i innloggings-e-posten peker på.
 *
 * Lenken logger ikke inn av seg selv. Mange bedrifter har e-postfiltre som
 * åpner alle lenker for å sjekke dem, og en lenke som løste seg inn ved
 * åpning ville vært brukt opp før mottakeren rakk å klikke. Derfor vises en
 * knapp, og først når den trykkes løses nøkkelen inn (se actions.ts).
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tokenHash = one(params.token_hash);
  const type = one(params.type);
  if (!tokenHash || !TYPES.includes(type)) redirect('/logg-inn?feil=manglende-kode');

  const changingEmail = type === 'email_change';

  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Min side</div>
        <h1>{changingEmail ? 'Bekreft ny e-postadresse' : 'Fullfør innloggingen'}</h1>
        <p>
          {changingEmail
            ? 'Trykk på knappen for å bekrefte at kontoen skal bruke den nye adressen.'
            : 'Trykk på knappen for å logge inn på Min side.'}
        </p>
      </div>

      <section className="auth-section">
        <form className="auth-card" action={confirmLink}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <button type="submit" className="btn-primary auth-submit">
            {changingEmail ? 'Bekreft adressen →' : 'Logg inn →'}
          </button>
          <p className="auth-hint">
            Lenken kan brukes én gang. Ba du ikke om den, kan du lukke denne siden.
          </p>
        </form>
      </section>

      <Footer />
    </>
  );
}
