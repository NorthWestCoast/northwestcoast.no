import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Personvernerklæring',
  description:
    'Hvilke personopplysninger NorthWest Coast behandler, hvorfor, hvor lenge de lagres og hvilke rettigheter du har.',
  path: '/personvern',
});

/**
 * Personvernerklæring.
 *
 * Nødvendig fra det øyeblikket skjemaene begynte å lagre i database og
 * storage i stedet for bare å sende e-post. Databehandlerne under må holdes
 * oppdatert når stacken endres – særlig ved et eventuelt bytte av
 * e-postleverandør.
 */
const SIST_OPPDATERT = '22.09.2026';

export default function PersonvernPage() {
  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Personvern</div>
        <h1>Personvernerklæring</h1>
        <p>Sist oppdatert {SIST_OPPDATERT}</p>
      </div>

      <section className="legal-section">
        <article className="legal-body">
          <h2>Behandlingsansvarlig</h2>
          <p>
            Northwestcoast AS (org.nr. 998 196 159), Postboks 79, 6281 Søvik, er
            behandlingsansvarlig for personopplysningene som beskrives her.
            Spørsmål rettes til{' '}
            <a href="mailto:arve@astep.no">arve@astep.no</a> eller{' '}
            <a href="tel:+4790407341">+47 904 07 341</a>.
          </p>

          <h2>Hva vi samler inn, og hvorfor</h2>
          <table className="legal-table">
            <thead>
              <tr>
                <th>Situasjon</th>
                <th>Opplysninger</th>
                <th>Behandlingsgrunnlag</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bestillingsforespørsel</td>
                <td>Navn, e-post, telefon, fartøy/rederi, kommentar, innhold i bestillingen</td>
                <td>Tiltak før avtaleinngåelse (GDPR art. 6.1 b)</td>
              </tr>
              <tr>
                <td>Kontaktskjema</td>
                <td>Navn, e-post, telefon, firma, melding</td>
                <td>Berettiget interesse i å svare på henvendelser (art. 6.1 f)</td>
              </tr>
              <tr>
                <td>Vedlikeholdsregistrering</td>
                <td>Navn, e-post, fartøy, IMO, serienummer, kommentar, bilder av leideren</td>
                <td>Avtale og dokumentasjonsplikt (art. 6.1 b og c)</td>
              </tr>
              <tr>
                <td>Nyhetsbrev</td>
                <td>E-postadresse</td>
                <td>Samtykke (art. 6.1 a) – kan trekkes når som helst</td>
              </tr>
              <tr>
                <td>Min side</td>
                <td>E-post, tilknytning til selskap og fartøy</td>
                <td>Avtale (art. 6.1 b)</td>
              </tr>
            </tbody>
          </table>

          <h2>Deling av leiderens tilstand med los</h2>
          <p>
            Mannskap kan lage en delingslenke som viser bilder av leideren og
            innfestingspunktet, sammen med serienummer, produksjonsdato og siste
            servicerapport. Lenken er beskyttet av et tilfeldig token, utløper
            etter sju dager, og kan trekkes tilbake når som helst av fartøyet.
            Bildene slettes senest 90 dager etter at lenken er utløpt.
          </p>
          <p>
            Delingssiden er et hjelpemiddel. Den erstatter ikke skipsførerens
            plikt etter SOLAS kap. V regel 23 til å sørge for en forskriftsmessig
            ombordstigningsordning.
          </p>

          <h2>Statistikk</h2>
          <p>
            Vi bruker Plausible Analytics for besøksstatistikk. Plausible er
            europeisk, bruker ikke informasjonskapsler, og samler ikke inn
            personopplysninger eller sporer besøkende på tvers av nettsteder.
            Derfor har vi heller ingen samtykkebanner.
          </p>

          <h2>Databehandlere</h2>
          <ul>
            <li>
              <strong>Supabase</strong> – database og fillagring. Data lagres i
              EU (Frankfurt).
            </li>
            <li>
              <strong>Resend</strong> – utsending av e-post. Leverandøren er
              etablert i USA; overføring skjer på EUs standardkontrakter (SCC).
            </li>
            <li>
              <strong>Vercel</strong> – drift av nettsiden.
            </li>
            <li>
              <strong>Plausible Analytics</strong> – besøksstatistikk, EU-hostet.
            </li>
          </ul>

          <h2>Hvor lenge vi lagrer</h2>
          <ul>
            <li>Kontakthenvendelser: inntil 2 år etter siste kontakt.</li>
            <li>
              Bestillinger og servicehistorikk: så lenge kundeforholdet varer,
              og deretter så lenge bokførings- og dokumentasjonsplikt krever.
            </li>
            <li>Vedlikeholdslogg: så lenge leideren er i bruk hos fartøyet.</li>
            <li>Delingslenker for los og tilhørende bilder: 90 dager etter utløp.</li>
            <li>Nyhetsbrev: til du melder deg av.</li>
          </ul>

          <h2>Dine rettigheter</h2>
          <p>
            Du har rett til innsyn i, retting av og sletting av egne
            opplysninger, til å begrense eller protestere mot behandlingen, og
            til dataportabilitet. Ta kontakt på{' '}
            <a href="mailto:arve@astep.no">arve@astep.no</a>, så svarer vi innen
            30 dager. Mener du at vi behandler opplysninger i strid med
            regelverket, kan du klage til{' '}
            <a
              href="https://www.datatilsynet.no"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datatilsynet
            </a>.
          </p>
        </article>
      </section>

      <Footer />
    </>
  );
}
