import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import LadderCalculator from '@/components/ladder-calculator';
import JsonLd from '@/components/json-ld';
import { PRICE_TABLE, fmt, MAX_LENGTH } from '@/lib/products';
import { ATTACHMENT_ALLOWANCE_M, TIDE_PRESETS, metres } from '@/lib/ladder-calc';
import { abs, pageOpenGraph, SITE } from '@/lib/site';
import {
  ORG_ID,
  PRODUCT_ID,
  breadcrumbNode,
  faqNode,
  graph,
  webPageNode,
} from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Leiderkalkulator – regn ut riktig lengde på maritim leider',
  description:
    'Gratis kalkulator som regner ut hvor lang leider fartøyet ditt trenger. Legg inn høyde til innfesting, lastkondisjon, tidevann og sjøgang – få minimumslengde, antall trinn og anbefalt Argostep-modell.',
  alternates: { canonical: '/leiderkalkulator' },
  openGraph: pageOpenGraph({
    path: '/leiderkalkulator',
    title: 'Leiderkalkulator – regn ut riktig lengde på maritim leider',
    description:
      'Legg inn høyde til innfesting, lastkondisjon, tidevann og sjøgang – få minimumslengde, antall trinn og anbefalt modell.',
  }),
  keywords: [
    'leiderkalkulator',
    'hvor lang leider',
    'beregne leiderlengde',
    'leiderlengde fartøy',
    'losleider lengde',
    'livbåtleider lengde',
    'fribord leider',
    'maritim leider kalkulator',
  ],
};

/**
 * Questions the tool itself answers. Written as the short, complete answers an
 * answer engine can lift whole — each one is a full sentence that stands on its
 * own without the surrounding page.
 */
const TOOL_FAQS = [
  {
    q: 'Hvor lang må en maritim leider være?',
    a: 'Leideren må nå fra innfestingspunktet og helt ned til vannflaten under de forholdene fartøyet faktisk opererer i. I praksis betyr det høyden fra vannlinjen til innfestingen, pluss tillegg for økt fribord ved letteste lastkondisjon, tidevannsforskjellen i fartsområdet, en margin for sjøgang og fartøybevegelse, samt lengden som går med til å feste leideren i toppen.',
  },
  {
    q: 'Hvordan måler jeg fribordet riktig?',
    a: 'Mål loddrett fra vannflaten opp til punktet der leideren skal festes – rekke, dekksøye eller leiderkasse – slik fartøyet ligger i dag. Noter samtidig hvor mye høyere fartøyet ligger når det går tomt eller i ballast, siden leideren må rekke ned også i den kondisjonen.',
  },
  {
    q: 'Hvorfor må jeg legge til tidevann i beregningen?',
    a: 'Tidevannsforskjellen i Norge øker nordover, fra rundt 0,4 meter i Oslofjorden til omtrent 2,5 meter i Troms og Finnmark. En leider som akkurat når vannflaten ved høyvann, kan mangle over to meter ved lavvann. Derfor dimensjoneres leideren for laveste vannstand i fartsområdet.',
  },
  {
    q: 'Hva skjer hvis beregningen gir en lengde mellom to standardlengder?',
    a: 'Da velges nærmeste standardlengde oppover. Argostep leveres i hele meter fra 3 til 15 meter, og en leider som er litt for lang er trygg, mens en som er litt for kort ikke når ned til vannflaten.',
  },
  {
    q: 'Hvor mange trinn har en Argostep-leider?',
    a: 'Antall trinn følger lengden: en 3-meters leider har 10 trinn og en 15-meters leider har 46 trinn, altså tre trinn per meter pluss ett. Trinnene er sprøytestøpt glassfiberarmert plast og kan byttes enkeltvis.',
  },
  {
    q: 'Er beregningen fra kalkulatoren juridisk bindende?',
    a: 'Nei. Kalkulatoren er et veiledende dimensjoneringsverktøy basert på målene du oppgir. Hvilke krav som gjelder til leidertype, utforming og sertifisering avhenger av fartøyets størrelse, fartsområde og gjeldende forskrift, og må kontrolleres mot Sjøfartsdirektoratet.',
  },
];

/** The measuring procedure, mirrored into HowTo schema below. */
const HOW_TO_STEPS = [
  {
    name: 'Mål høyden til innfestingen',
    text: 'Mål loddrett fra vannflaten opp til punktet der leideren festes – rekke, dekksøye eller leiderkasse – slik fartøyet ligger i dag.',
  },
  {
    name: 'Finn økningen ved letteste kondisjon',
    text: 'Noter hvor mye høyere fartøyet ligger når det går tomt eller i ballast. Denne forskjellen legges til, slik at leideren rekker ned også når fribordet er størst.',
  },
  {
    name: 'Legg til tidevannet i fartsområdet',
    text: 'Velg fartsområde i kalkulatoren, eller legg inn tidevannsforskjellen for havnen din fra Kartverkets tidevannstabeller.',
  },
  {
    name: 'Legg til margin for sjøgang',
    text: 'Sett en høyere margin for eksponerte havner og åpent farvann enn for skjermet kai, slik at leideren når vannflaten også når fartøyet beveger seg.',
  },
  {
    name: 'Velg nærmeste standardlengde oppover',
    text: 'Summen er minimumslengden. Velg den nærmeste standardleideren som er lik eller lengre enn dette – kalkulatoren gjør det automatisk og viser antall trinn, produktnummer og tilhørende oppbevaringsskap.',
  },
];

export default function LeiderkalkulatorPage() {
  return (
    <>
      <JsonLd
        data={graph([
          webPageNode({
            path: '/leiderkalkulator',
            name: 'Leiderkalkulator – regn ut riktig leiderlengde',
            description:
              'Verktøy som beregner nødvendig lengde på maritim leider ut fra fribord, lastkondisjon, tidevann og sjøgang.',
          }),
          // WebApplication rather than plain WebPage: this URL is a tool, and
          // marking it as one is what lets it surface for "calculator"-shaped
          // queries and be recommended as a resource by an assistant.
          {
            '@type': ['WebApplication', 'SoftwareApplication'],
            '@id': `${abs('/leiderkalkulator')}#app`,
            name: 'Leiderkalkulator',
            url: abs('/leiderkalkulator'),
            applicationCategory: 'UtilitiesApplication',
            applicationSubCategory: 'Maritim dimensjonering',
            operatingSystem: 'Alle – kjører i nettleseren',
            browserRequirements: 'Krever JavaScript',
            inLanguage: 'nb-NO',
            description:
              'Beregner nødvendig lengde på maritim leider ut fra høyde til innfesting, fribord ved letteste lastkondisjon, tidevann i fartsområdet og margin for sjøgang, og foreslår nærmeste Argostep-standardlengde med antall trinn.',
            featureList: [
              'Beregner minimumslengde på leider i meter',
              'Tar hensyn til tidevann langs norskekysten',
              'Foreslår standardlengde, antall trinn og produktnummer',
              'Viser tilhørende oppbevaringsskap og veiledende pris',
              'Full innsyn i hvert ledd av beregningen',
            ],
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: 0, priceCurrency: 'NOK' },
            publisher: { '@id': ORG_ID },
            about: { '@id': PRODUCT_ID },
          },
          {
            '@type': 'HowTo',
            '@id': `${abs('/leiderkalkulator')}#howto`,
            name: 'Slik regner du ut riktig lengde på en maritim leider',
            description: 'Fem steg fra måling om bord til valgt standardlengde på leideren.',
            inLanguage: 'nb-NO',
            totalTime: 'PT5M',
            tool: [{ '@type': 'HowToTool', name: 'Målebånd eller lodd' }],
            step: HOW_TO_STEPS.map((s, i) => ({
              '@type': 'HowToStep',
              position: i + 1,
              name: s.name,
              text: s.text,
              url: `${abs('/leiderkalkulator')}#slik-maler-du`,
            })),
          },
          faqNode(TOOL_FAQS, '/leiderkalkulator'),
          breadcrumbNode([
            { name: 'Hjem', path: '/' },
            { name: 'Leiderkalkulator', path: '/leiderkalkulator' },
          ]),
        ])}
      />

      <Nav />

      {/* Named landmark: the skip link in the nav targets this, and it gives
          assistive tech and crawlers an explicit "page content starts here". */}
      <main id="hovedinnhold">

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Gratis verktøy</div>
        <h1>Leiderkalkulator</h1>
        <p>
          Regn ut hvor lang leider fartøyet ditt faktisk trenger – med tidevann, lastkondisjon
          og sjøgang tatt med i regnestykket.
        </p>
      </div>

      <section className="calc-section" id="kalkulator">
        <LadderCalculator />
      </section>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dual dualBottomFill="var(--sand-light)" />

      {/* Method: the content that makes the tool citable */}
      <section className="calc-method" id="slik-maler-du">
        <div className="calc-method-inner">
          <div className="lbl lbl-dark">Metoden</div>
          <h2 className="stitle dark">Slik regner du ut leiderlengden</h2>
          <p className="sub dark" style={{ marginBottom: '2.5rem' }}>
            En leider skal nå fra innfestingspunktet og helt ned til vannflaten under de forholdene
            fartøyet faktisk opererer i – ikke bare slik det ligger ved kai en stille dag. Derfor
            består regnestykket av fem ledd.
          </p>

          <ol className="calc-steps">
            {HOW_TO_STEPS.map((step, i) => (
              <li key={step.name}>
                <span className="calc-step-n">{i + 1}</span>
                <div>
                  <h3>{step.name}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="calc-formula">
            <span className="calc-formula-label">Formelen kalkulatoren bruker</span>
            <p>
              Minimumslengde = høyde til innfesting + ekstra fribord ved letteste kondisjon
              + tidevannsforskjell + margin for sjøgang + {metres(ATTACHMENT_ALLOWANCE_M)} m
              festetillegg. Summen rundes opp til nærmeste standardlengde.
            </p>
          </div>
        </div>
      </section>

      {/* Tidal reference table */}
      <section className="calc-tide">
        <div className="calc-tide-inner">
          <div className="lbl">Tidevann</div>
          <h2 className="stitle">Typisk tidevannsforskjell langs norskekysten</h2>
          <p className="sub" style={{ marginBottom: '2rem' }}>
            Tidevannsforskjellen øker nordover. En leider som akkurat når vannflaten ved høyvann i
            Tromsø, kan mangle over to meter ved lavvann.
          </p>

          <div className="calc-table-wrap">
            <table className="calc-table">
              <caption className="sr-only">
                Typisk tidevannsforskjell brukt til dimensjonering, etter fartsområde
              </caption>
              <thead>
                <tr>
                  <th scope="col">Fartsområde</th>
                  <th scope="col">Typisk tidevannsforskjell</th>
                </tr>
              </thead>
              <tbody>
                {TIDE_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.label}</th>
                    <td>ca. {metres(p.tide)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="calc-table-note">
            Avrundede verdier til bruk i dimensjonering. Eksakt tidevann for en bestemt havn finner
            du i Kartverkets tidevannstabeller på{' '}
            <a href="https://www.kartverket.no/til-sjos/se-havniva" target="_blank" rel="noopener noreferrer">
              sehavniva.no
            </a>.
          </p>
        </div>
      </section>

      <Wave top="var(--navy-mid)" bottom="var(--sand-light)" dual dualBottomFill="var(--sand-light)" />

      {/* Standard length reference */}
      <section className="calc-lengths">
        <div className="calc-lengths-inner">
          <div className="lbl lbl-dark">Referanse</div>
          <h2 className="stitle dark">Argostep standardlengder</h2>
          <p className="sub dark" style={{ marginBottom: '2rem' }}>
            Alle standardlengder med antall trinn, produktnummer, tilhørende oppbevaringsskap og
            veiledende pris eks. mva.
          </p>

          <div className="calc-table-wrap">
            <table className="calc-table calc-table-light">
              <caption className="sr-only">
                Argostep standardlengder med antall trinn, produktnummer og veiledende pris
              </caption>
              <thead>
                <tr>
                  <th scope="col">Lengde</th>
                  <th scope="col">Trinn</th>
                  <th scope="col">Produktnr.</th>
                  <th scope="col">Oppbevaringsskap</th>
                  <th scope="col">Veiledende pris</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_TABLE.map((row) => (
                  <tr key={row.productNumber}>
                    <th scope="row">{row.length} m</th>
                    <td>{row.steps}</td>
                    <td>{row.productNumber}</td>
                    <td>{row.cabinetName}</td>
                    <td>{fmt(row.price)} kr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="calc-table-note calc-table-note-dark">
            Priser er veiledende og eks. mva. Behov utover {MAX_LENGTH} meter skreddersys –{' '}
            <Link href="/#kontakt">ta kontakt</Link> med målene dine.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="calc-faq">
        <div className="calc-faq-inner">
          <div className="lbl">Spørsmål og svar</div>
          <h2 className="stitle">Om beregning av leiderlengde</h2>

          <div className="faq-list" style={{ marginTop: '2rem' }}>
            {TOOL_FAQS.map((faq) => (
              <details className="fi" key={faq.q}>
                <summary className="fq">
                  <h3 className="fq-title">{faq.q}</h3>
                  <span className="fi-icon" aria-hidden="true">+</span>
                </summary>
                <p className="fa">{faq.a}</p>
              </details>
            ))}
          </div>

          <div className="calc-cta">
            <h2>Usikker på hva som gjelder for ditt fartøy?</h2>
            <p>
              Ring oss med målene dine, så finner vi riktig leider sammen. Vi skreddersyr også
              lengder utover standardsortimentet.
            </p>
            <div className="calc-cta-actions">
              <a href={`tel:${SITE.phone}`} className="btn-primary">Ring {SITE.phoneDisplay}</a>
              <Link href="/produkt" className="btn-ghost">Se produktet →</Link>
            </div>
          </div>
        </div>
      </section>

      </main>

      <Footer />
    </>
  );
}
