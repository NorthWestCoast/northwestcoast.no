'use client';

import { useState } from 'react';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { CheckCircle, XCircle, AlertCircle, FileText, Ruler, Shield, BookOpen, ArrowUpRight, Waves, ChevronDown, Clock, Eye, Tag, Package } from 'lucide-react';

/* ── TYPES ── */

type RegRef = { label: string; url?: string };

type LadderSpec = {
  required: boolean;
  conditional?: boolean;  // only required when carrying survival craft with fixed embarkation station
  lengde: string;
  trinn?: string;
  teknisk?: string;
  note?: string;
  refs: RegRef[];
};

type Vessel = {
  id: string;
  tag: string;
  label: string;
  loa: string;
  area: string;
  losleider: LadderSpec;
  livbat: LadderSpec;
  mob: LadderSpec;
  inspFreq: string;
};

type Section = 'losleider' | 'livbat' | 'mob';

/* ── DATA ── */

const VESSELS: Vessel[] = [
  {
    id: 'fiske-liten',
    tag: 'Fiskefartøy < 15 m',
    label: 'Fiskefartøy under 15 m',
    loa: 'Under 15 m',
    area: 'Kyst og lokale farvann',
    losleider: {
      required: true,
      conditional: true,
      lengde: 'Skal nå fra oppstigningspunktet ned til havoverflaten under alle driftsforhold',
      trinn: 'Sklisikre, horisontale trinn; maks 300 mm mellom trinn',
      teknisk: 'Krav til trinn, siderep og festeanordninger følger av § 41. IMO A.1045(27) gir de geometriske minimumskravene: Trinnmål min. 480 × 115 × 25 mm. Spreder (stiversteg) plasseres på 5. trinn fra bunnen, deretter maks hvert 9. trinn, for å hindre vridning av leideren.',
      note: 'Krav om losleider utløses normalt først ved fribord over 1,5 m. For fartøy med fribord under 1,5 m skjer bording typisk via skipets konstruksjon eller MOB-leider. Losleider er dessuten primært relevant der los eller redningspersonell går om bord i åpent farvann.',
      refs: [
        { label: 'FOR-2013-11-22-1404 § 41', url: 'https://lovdata.no/forskrift/2013-11-22-1404' },
        { label: 'SOLAS kap. V, reg. 23' },
        { label: 'IMO res. A.1045(27)' },
        { label: 'ISO 799' },
      ],
    },
    livbat: {
      required: true,
      conditional: true,
      lengde: 'Skal nå fra innstigningsdekket til vannoverflaten ved alle lastkondisjonene fartøyet opererer i',
      teknisk: 'Reglene for redningsmidler på fiskefartøy under 15 m finnes i kapittel 4 (Redningsmidler) i samme forskrift. Livbåtleidere har IKKE spreders – de er beregnet for nødevakuering til redningsflåte og skal være fast rigget ved hvert innstigningstasjon. Tekniske krav er hentet fra LSA-koden kap. VI § 6.1.6.',
      note: 'Kun påkrevd der fartøyet fører livbåt eller redningsflåte med fast embarkasjonsstasjon. En hydrostatisk utløst flåte (automatisk frigjøring) utløser ikke krav om livbåtleider.',
      refs: [
        { label: 'FOR-2013-11-22-1404 kap. 4 (Redningsmidler)', url: 'https://lovdata.no/forskrift/2013-11-22-1404' },
        { label: 'LSA Code kap. VI § 6.1.6' },
      ],
    },
    mob: {
      required: true,
      lengde: 'Skal nå fra rekka til vannoverflaten; fartøyet skal til enhver tid ha en løsning for å heve en person fra sjøen',
      trinn: 'Sklisikre trinn; leideren skal kunne betjenes av én person',
      teknisk: 'På fiskefartøy under 15 m er redningsleider / MOB-leider typisk den viktigste og vanligste løse leiderplikten. En enkel tau- eller båndstige som rulles ut over siden er den vanligste løsningen. Leideren skal ikke kreve spesialopplæring og skal fungere for en utmattet eller halvbevisstløs person.',
      note: 'For småbåter er dette det primære kravet til løs leider – ikke losleider. Losleider er kun aktuelt der fartøyet forventer å ta om bord los i åpent farvann.',
      refs: [
        { label: 'FOR-2013-11-22-1404 kap. 4 (Redningsmidler)', url: 'https://lovdata.no/forskrift/2013-11-22-1404' },
        { label: 'SOLAS kap. III, reg. 17' },
      ],
    },
    inspFreq: 'Besiktelse ved fornying av sikkerhetssertifikat; visuell kontroll etter rederisystemet (SMS)',
  },
  {
    id: 'fiske-stor',
    tag: 'Fiskefartøy ≥ 15 m',
    label: 'Fiske- og fangstfartøy 15 m og over',
    loa: '15 m og over',
    area: 'Kyst, havfiske og fjernere farvann',
    losleider: {
      required: true,
      lengde: 'Tilsvarer fartøyets fribord; ved fribord over 9 m skal losleider kombineres med fallremsleider (accommodation ladder) – leideren skal overlappe/strekke seg min. 2 meter over fallremsleiderens nedre plattform',
      trinn: 'Trinnmål min. 480 × 115 × 25 mm; maks 300 mm mellom trinn; spreder på 5. trinn fra bunnen, deretter maks hvert 9. trinn',
      teknisk: 'Kravene følger av § 6-6 i forskriften. SOLAS V/23 og IMO A.1045(27) setter de tekniske minimumsstandardene som norsk rett bygger på. Leideren skal til enhver tid nå havoverflaten fra ombordstigningstrinnet, inkludert under bevegelse av fartøyet.',
      note: 'Losleider (pilot ladder) er en navigasjonsforskrift-leider – separat fra livbåtleider og redningsleider. De tre har ulike tekniske krav og regelverk.',
      refs: [
        { label: 'FOR-2000-06-13-660 § 6-6', url: 'https://lovdata.no/forskrift/2000-06-13-660' },
        { label: 'SOLAS kap. V, reg. 23' },
        { label: 'IMO res. A.1045(27)' },
        { label: 'ISO 799' },
      ],
    },
    livbat: {
      required: true,
      lengde: 'Skal nå fra innstigningsdekket til havoverflaten ved fartøyets letteste dypgående',
      teknisk: 'Kravene til redningsmidler – herunder livbåtleidere – finnes i kapittel 5 (Redningsmidler) i FOR-2000-06-13-660. Livbåtleideren har ikke spreaders og er permanent rigget ved hver innstigningstasjon for livbåt/redningsflåte. LSA-koden kap. VI § 6.1.6 angir de tekniske konstruksjonskravene.',
      refs: [
        { label: 'FOR-2000-06-13-660 kap. 5 (Redningsmidler)', url: 'https://lovdata.no/forskrift/2000-06-13-660' },
        { label: 'LSA Code kap. VI § 6.1.6' },
      ],
    },
    mob: {
      required: true,
      lengde: 'Skal nå fra dekk til vannoverflaten i alle driftsforhold og lastkondisjonene',
      trinn: 'Sklisikre trinn; betjenes av én person',
      teknisk: 'Kravene til MOB/redningsleider finnes i kapittel 5 (Redningsmidler) i FOR-2000-06-13-660, supplert av SOLAS kap. III reg. 17. Leideren skal sikre at et bevisstløst eller utmattet mannskap kan heises om bord uten hjelp fra den som er i vannet.',
      refs: [
        { label: 'FOR-2000-06-13-660 kap. 5 (Redningsmidler)', url: 'https://lovdata.no/forskrift/2000-06-13-660' },
        { label: 'SOLAS kap. III, reg. 17' },
      ],
    },
    inspFreq: 'Periodisk besiktelse (vanligvis hvert 5. år); årsbesiktelse etter rederisystemet',
  },
  {
    id: 'arbeidsbat',
    tag: 'Arbeidsbåt < 15 m',
    label: 'Arbeidsbåt og servicefartøy under 15 m',
    loa: 'Under 15 m',
    area: 'Havner, kyst og offshore støtteoperasjoner',
    losleider: {
      required: true,
      conditional: true,
      lengde: 'Skal nå fra dekksnivå til vannoverflaten under letteste driftskondisjon; typisk 2–5 m for fartøy i denne klassen',
      trinn: 'Trinnmål min. 480 × 115 × 25 mm; maks 300 mm mellom trinn; spreder på 5. trinn fra bunnen, deretter maks hvert 9. trinn',
      teknisk: 'Arbeidsbåter og servicefartøy under 15 m er ikke fiskefartøy og faller under de generelle kommersielle fartøysreglene. FOR-2014-09-05-1157 §§ 25–28 gjelder for atkomstmidler for los, og bygger på SOLAS V/23 og IMO A.1045(27). Kravene er de samme som for større handelsskip, men lengden skalerer naturlig med fartøyets mindre fribord.',
      note: 'Krav om losleider utløses normalt først ved fribord over 1,5 m. Arbeidsbåter under 15 m er ikke dekket av fiskefartøyforskriftene – de reguleres som kommersielle ikke-fiskende fartøy.',
      refs: [
        { label: 'FOR-2014-09-05-1157 §§ 25–28', url: 'https://lovdata.no/forskrift/2014-09-05-1157' },
        { label: 'SOLAS kap. V, reg. 23' },
        { label: 'IMO res. A.1045(27)' },
        { label: 'ISO 799' },
      ],
    },
    livbat: {
      required: true,
      conditional: true,
      lengde: 'Skal nå fra innstigningsdekket til vannoverflaten ved fartøyets letteste dypgående',
      teknisk: 'FOR-2014-07-01-1019 fastslår at SOLAS kap. III gjelder som norsk rett. Livbåtleideren følger LSA-koden kap. VI § 6.1.6: selvbærende, sklisikre trinn, ingen spreders, permanent rigget ved hvert innstigningstasjon for redningsflåte.',
      note: 'Kun påkrevd der fartøyet fører livbåt eller redningsflåte med fast embarkasjonsstasjon. En hydrostatisk utløst flåte (automatisk frigjøring) utløser ikke krav om livbåtleider.',
      refs: [
        { label: 'FOR-2014-07-01-1019', url: 'https://lovdata.no/forskrift/2014-07-01-1019' },
        { label: 'SOLAS kap. III' },
        { label: 'LSA Code kap. VI § 6.1.6' },
      ],
    },
    mob: {
      required: true,
      lengde: 'Skal nå fra rekka til vannoverflaten; fartøyet skal ha en løsning for å heve en person fra sjøen',
      teknisk: 'Som for fiskefartøy under 15 m er redningsleider / MOB-leider typisk det viktigste kravet til løs leider for arbeidsbåter. En enkel tau- eller båndstige er den vanligste løsningen. FOR-2014-07-01-1019 → SOLAS kap. III reg. 17 regulerer krav til Mann-Over-Bord (MOB) beredskap.',
      refs: [
        { label: 'FOR-2014-07-01-1019', url: 'https://lovdata.no/forskrift/2014-07-01-1019' },
        { label: 'SOLAS kap. III, reg. 17' },
      ],
    },
    inspFreq: 'Periodisk besiktelse etter rederisystemet (SMS/ISM); besiktelse ved fornyelse av sertifikat',
  },
  {
    id: 'lasteskip',
    tag: 'Lasteskip & offshore',
    label: 'Lasteskip, tankskip, offshore-enheter og lektere',
    loa: 'Alle størrelser; SOLAS fullt ut ved ≥ 500 GT i internasjonal fart',
    area: 'Innenriks og internasjonal fart',
    losleider: {
      required: true,
      lengde: 'Fribord ≤ 9 m: losleider alene. Fribord > 9 m: losleider kombinert med fallremsleider (accommodation ladder) – leideren skal overlappe/strekke seg min. 2 meter over fallremsleiderens nedre plattform',
      trinn: 'Trinnmål min. 480 × 115 × 25 mm; maks 300 mm mellom trinn; spreder på 5. trinn fra bunnen, deretter maks hvert 9. trinn; siderep min. 18 mm diameter',
      teknisk: 'FOR-2014-09-05-1157 §§ 25–28 implementerer SOLAS kap. V reg. 23 direkte i norsk rett. For skip ≥ 500 GT i internasjonal fart gjelder SOLAS fullt ut. Skip < 500 GT i innenriksfart er fortsatt underlagt FOR-2014-09-05-1157, men med proporsjonale krav. IMO A.1045(27) setter bindende geometriske minstekrav; ISO 799 er den tekniske teststandarden. Et stort skip har typisk bare én eller to losleidere om bord.',
      note: 'Feil rigging av losleider er blant de hyppigst registrerte avvikene ved Port State Control-inspeksjoner.',
      refs: [
        { label: 'FOR-2014-09-05-1157 §§ 25–28', url: 'https://lovdata.no/forskrift/2014-09-05-1157' },
        { label: 'SOLAS kap. V, reg. 23' },
        { label: 'IMO res. A.1045(27)' },
        { label: 'ISO 799' },
      ],
    },
    livbat: {
      required: true,
      lengde: 'Skal nå fra innstigningsdekket til havoverflaten ved fartøyets letteste dypgående – ved hvert innstigningstasjon for livbåt og redningsflåte',
      teknisk: 'FOR-2014-07-01-1019 fastslår at SOLAS kap. III gjelder som norsk rett. LSA-koden kap. VI § 6.1.6 setter kravene: selvbærende leider, sklisikre trinn, ingen spreaders, permanent rigget. På store skip er dette den leidertypen det er flest av – ett sett ved hvert utsettingssted for livbåt og redningsflåte. Minimum én leider per side.',
      refs: [
        { label: 'FOR-2014-07-01-1019', url: 'https://lovdata.no/forskrift/2014-07-01-1019' },
        { label: 'SOLAS kap. III' },
        { label: 'LSA Code kap. VI § 6.1.6' },
      ],
    },
    mob: {
      required: true,
      lengde: 'Skal nå fra dekk til vannoverflaten i alle lastkondisjonene',
      teknisk: 'FOR-2014-07-01-1019 → SOLAS kap. III reg. 17 regulerer krav til MOB-beredskap. Større skip kan ha dedikert MOB-båt eller redningsnett som primær løsning, men redningsleider er alltid en del av beredskapen. Leideren skal plasseres slik at den er tilgjengelig fra begge sider av skipet.',
      note: 'Større skip har ofte dedikert MOB-båt som primær løsning. Redningsleider er likevel alltid påkrevd om bord som supplement.',
      refs: [
        { label: 'FOR-2014-07-01-1019', url: 'https://lovdata.no/forskrift/2014-07-01-1019' },
        { label: 'SOLAS kap. III, reg. 17' },
      ],
    },
    inspFreq: 'Årsbesiktelse av flaggstat eller anerkjent organisasjon (RO); 5-årig fornyelsesbesiktelse; Port State Control ved hvert anløp',
  },
  {
    id: 'passasjer',
    tag: 'Passasjerskip',
    label: 'Passasjerskip (12 eller flere passasjerer)',
    loa: 'Alle størrelser; 12+ passasjerer er definerende',
    area: 'Innenriks og internasjonal fart',
    losleider: {
      required: true,
      lengde: 'Fribord ≤ 9 m: losleider alene. Fribord > 9 m: losleider kombinert med fallremsleider – leideren skal overlappe/strekke seg min. 2 meter over fallremsleiderens nedre plattform. Strengere tilsynsregime enn lasteskip.',
      trinn: 'Trinnmål min. 480 × 115 × 25 mm; maks 300 mm mellom trinn; spreder på 5. trinn fra bunnen, deretter maks hvert 9. trinn; siderep min. 18 mm diameter',
      teknisk: 'FOR-2014-09-05-1157 §§ 25–28 gjelder på lik linje med lasteskip. Passasjerskip er imidlertid underlagt hyppigere og strengere PSC-inspeksjoner, og avvik på losleider vil normalt resultere i umiddelbar anmerkning. Et skip klassifiseres som passasjerskip ved 12 eller flere passasjerer, uavhengig av bruttotonn.',
      note: 'Klassifiseringen som passasjerskip utløses av antall passasjerer (≥ 12), ikke av tonnasje.',
      refs: [
        { label: 'FOR-2014-09-05-1157 §§ 25–28', url: 'https://lovdata.no/forskrift/2014-09-05-1157' },
        { label: 'SOLAS kap. V, reg. 23' },
        { label: 'IMO res. A.1045(27)' },
        { label: 'ISO 799' },
      ],
    },
    livbat: {
      required: true,
      lengde: 'Skal nå fra innstigningsdekket til havoverflaten under alle lastkondisjonene. Krav til antall stasjoner er strengere enn for lasteskip.',
      teknisk: 'FOR-2014-07-01-1019 → SOLAS kap. III setter strengere krav for passasjerskip enn for lasteskip: hyppigere mønstringsøvelser, krav til belysning av leidere og stasjoner, og krav til at leideren kan betjenes av én person. LSA-koden kap. VI § 6.1.6 gjelder. For norske innenrikspassasjerskip gjelder i tillegg EU-direktiv 2009/45/EF.',
      note: 'Norske passasjerskip i innenriksfart er i tillegg regulert av EU-direktiv 2009/45/EF, gjennomført i norsk rett.',
      refs: [
        { label: 'FOR-2014-07-01-1019', url: 'https://lovdata.no/forskrift/2014-07-01-1019' },
        { label: 'SOLAS kap. III (passasjerskip)' },
        { label: 'LSA Code kap. VI § 6.1.6' },
        { label: 'EU-direktiv 2009/45/EF (innenriks)' },
      ],
    },
    mob: {
      required: true,
      lengde: 'Skal nå fra dekk til vannoverflaten i alle lastkondisjonene; tilgjengelig fra begge sider av skipet',
      teknisk: 'FOR-2014-07-01-1019 → SOLAS kap. III reg. 17 gjelder. Passasjerskip er underlagt strengere MOB-krav enn lasteskip, inkludert krav til MOB-beredskapsplan og regelmessige øvelser. Redningsleideren skal kunne brukes av en ufaglært passasjer og fungere for en utmattet eller halvbevisstløs person.',
      refs: [
        { label: 'FOR-2014-07-01-1019', url: 'https://lovdata.no/forskrift/2014-07-01-1019' },
        { label: 'SOLAS kap. III, reg. 17' },
      ],
    },
    inspFreq: 'Årsbesiktelse obligatorisk; Port State Control ved hvert anløp; fornyelse av passasjersertifikat hvert 5. år',
  },
];

const VESSEL_TAGS = ['Fiskefartøy < 15 m', 'Fiskefartøy ≥ 15 m', 'Arbeidsbåt < 15 m', 'Lasteskip & offshore', 'Passasjerskip'];

const SECTIONS: { id: Section; label: string; shortLabel: string; color: string }[] = [
  { id: 'losleider', label: 'Losleider / pilot ladder', shortLabel: 'Losleider', color: 'var(--green)' },
  { id: 'livbat', label: 'Livbåtleider', shortLabel: 'Livbåtleider', color: '#f5a623' },
  { id: 'mob', label: 'Redningsleider / MOB-leider', shortLabel: 'MOB-leider', color: '#4a9eff' },
];

const LENGTH_TABLE = [
  { freeboard: '0,6 – 1,0 m', typical: 'Liten fiskebåt under 10 m', minLength: '2,0 m', steps: '5–7', note: 'Fribord under 1,5 m utløser normalt ikke krav om rigget losleider iht. SOLAS – bording skjer via skipets konstruksjon eller MOB-leider' },
  { freeboard: '1,0 – 1,5 m', typical: 'Fiskefartøy 10–12 m', minLength: '2,5 – 3,0 m', steps: '7–9', note: 'Fribord under 1,5 m utløser normalt ikke krav om rigget losleider iht. SOLAS – bording skjer via skipets konstruksjon eller MOB-leider' },
  { freeboard: '1,5 – 2,5 m', typical: 'Fiskefartøy / servicebåt 12–15 m', minLength: '3,0 – 4,0 m', steps: '9–12', note: '' },
  { freeboard: '2,5 – 4,0 m', typical: 'Fiskefartøy 15–20 m', minLength: '4,0 – 6,0 m', steps: '11–17', note: '' },
  { freeboard: '4,0 – 6,0 m', typical: 'Fiskefartøy 20–24 m / lite lasteskip', minLength: '6,0 – 8,0 m', steps: '17–23', note: '' },
  { freeboard: '6,0 – 9,0 m', typical: 'Handelsskip / passasjerskip', minLength: '8,0 – 11,0 m', steps: '23–31', note: '' },
  { freeboard: '9,0 – 13,0 m', typical: 'Større lasteskip', minLength: '10,0 – 15,0 m', steps: '29–43', note: 'Kombinasjonsleider iht. SOLAS V/23; Argostep leveres opp til 15 m og dekker losleider-delen' },
  { freeboard: '> 13,0 m', typical: 'Store lasteskip / cruiseskip', minLength: 'Losleider (maks 15 m) + fallremsleider', steps: 'Kombinert løsning', note: 'SOLAS V/23 krav' },
];

const REGS = [
  {
    name: 'FOR-2013-11-22-1404',
    shortName: 'Fiskefartøy < 15 m',
    icon: FileText,
    color: 'var(--green)',
    url: 'https://lovdata.no/forskrift/2013-11-22-1404',
    losRef: '§ 41',
    livbatRef: 'Kap. 4',
    desc: 'Regulerer alle sikkerhets- og utstyrskrav for norske fiske- og fangstfartøy under 15 meters lengde. § 41 omhandler entringsleidere (losleider); kapittel 4 dekker redningsmidler inkludert livbåtleider og redningsleider.',
  },
  {
    name: 'FOR-2000-06-13-660',
    shortName: 'Fiskefartøy ≥ 15 m',
    icon: FileText,
    color: 'var(--green)',
    url: 'https://lovdata.no/forskrift/2000-06-13-660',
    losRef: '§ 6-6',
    livbatRef: 'Kap. 5',
    desc: 'Regulerer konstruksjon, utstyr, drift og besiktigelse for norske fiske- og fangstfartøy 15 meter og over. § 6-6 inneholder krav til entringsleidere (losleider); kapittel 5 gjelder redningsmidler inkludert livbåtleider og redningsleider.',
  },
  {
    name: 'FOR-2014-09-05-1157',
    shortName: 'Ikke-fiskende kommersielle fartøy – navigasjon',
    icon: BookOpen,
    color: '#4a9eff',
    url: 'https://lovdata.no/forskrift/2014-09-05-1157',
    losRef: '§§ 25–28',
    livbatRef: '—',
    desc: 'Forskrift om navigasjon og navigasjonshjelpemidler for skip og flyttbare innretninger. §§ 25–28 implementerer SOLAS V/23 og regulerer atkomstmidler for los (losleider) for alle ikke-fiskende kommersielle fartøy – arbeidsbåter, lasteskip, passasjerskip og offshore-enheter.',
  },
  {
    name: 'FOR-2014-07-01-1019',
    shortName: 'Handelsskip – redningsredskaper',
    icon: Shield,
    color: '#f5a623',
    url: 'https://lovdata.no/forskrift/2014-07-01-1019',
    losRef: '—',
    livbatRef: 'Hele forskriften → SOLAS III / LSA VI § 6.1.6',
    desc: 'Forskrift om redningsredskaper på skip. Fastslår at SOLAS kapittel III gjelder som norsk lov for handelsskip, passasjerskip, offshore-enheter og lektere. De tekniske kravene til livbåtleider og redningsleider (MOB) følger av LSA-koden kap. VI § 6.1.6 og SOLAS III/17.',
  },
];

const MAINTENANCE = [
  {
    icon: Clock,
    color: '#f5a623',
    title: '30-månedersregelen',
    rule: 'ISO 799-1 / IMO A.1045(27)',
    body: [
      'Senest 30 måneder etter produksjonsdato må leideren enten gjennomgå formell styrketest (resertifisering) hos godkjent anlegg, eller kasseres og byttes ut med en ny.',
      'Regelen gjelder uavhengig av leiderens tilsynelatende tilstand – en «for gammel» leider gir automatisk avvik ved Port State Control.',
    ],
  },
  {
    icon: Eye,
    color: 'var(--green)',
    title: 'Kontroll før bruk',
    rule: 'SOLAS V/23 / IMO A.1045(27)',
    body: [
      'Trinn: kontroller for sprekker, deformasjoner og skader i glassfiberarmert plast.',
      'Siderep: kontroller for slitasje, kutt og frynser – særlig ved festepunktene øverst.',
      'Spreders (stiversteg): beslag skal sitte fast og stiversteg skal ligge horisontalt.',
      'Festeanordninger og karabiner: funksjonstest før rigging.',
    ],
  },
  {
    icon: Tag,
    color: '#4a9eff',
    title: 'Merking og sertifikat',
    rule: 'IMO A.1045(27) / ISO 799-1',
    body: [
      'Hver losleider skal ha permanent ID-brikke. Produksjonssertifikatet (type-approval certificate) skal oppbevares om bord og samsvare med brikken.',
      'Manglende eller ikke-samsvarende sertifikat er et av de hyppigst registrerte avvikene ved PSC-inspeksjon.',
    ],
  },
  {
    icon: Package,
    color: 'var(--green)',
    title: 'Lagring og vedlikehold',
    rule: 'ISO 799-1',
    body: [
      'Lagres tørt og beskyttet mot direkte sollys og kjemikaliepåvirkning.',
      'Tørk grundig etter bruk i saltvann – saltavleiringer akselererer slitasje på rep og festepunkter.',
      'Oppbevar i original pose eller kasse; unngå å la leideren ligge oppkveilet på åpent dekk over tid.',
    ],
  },
];

/* ── HELPERS ── */

function StatusBadge({ ok, conditional, label }: { ok: boolean; conditional?: boolean; label: string }) {
  if (conditional) return (
    <span className="rv-badge rv-badge-conditional">
      <AlertCircle size={13} strokeWidth={2.5} /> {label} (betinget)
    </span>
  );
  if (ok) return (
    <span className="rv-badge rv-badge-yes">
      <CheckCircle size={13} strokeWidth={2.5} /> {label}
    </span>
  );
  return (
    <span className="rv-badge rv-badge-no">
      <XCircle size={13} strokeWidth={2.5} /> {label}
    </span>
  );
}

function RefTag({ ref: r }: { ref: RegRef }) {
  if (r.url) {
    return (
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="rv-ref rv-ref-link">
        {r.label} <ArrowUpRight size={10} strokeWidth={2.5} />
      </a>
    );
  }
  return <span className="rv-ref">{r.label}</span>;
}

function LadderBlock({ spec, color, title }: { spec: LadderSpec; color: string; title: string }) {
  const isConditional = spec.conditional;
  return (
    <div className="rv-block rv-block-full">
      <div className="rv-block-title" style={{ color }}>
        {isConditional
          ? <AlertCircle size={15} strokeWidth={2.5} color={color} />
          : <CheckCircle size={15} strokeWidth={2.5} color={color} />
        }
        {title}
      </div>
      <div className="rv-rows">
        <div className="rv-row">
          <span className="rv-key">Lengde</span>
          <span className="rv-val">{spec.lengde}</span>
        </div>
        {spec.trinn && (
          <div className="rv-row">
            <span className="rv-key">Trinn</span>
            <span className="rv-val">{spec.trinn}</span>
          </div>
        )}
        {spec.teknisk && (
          <div className="rv-row">
            <span className="rv-key">Teknisk krav</span>
            <span className="rv-val">{spec.teknisk}</span>
          </div>
        )}
        {spec.note && (
          <div className="rv-note">
            <AlertCircle size={12} strokeWidth={2} /> {spec.note}
          </div>
        )}
        <div className="rv-row rv-row-refs">
          <span className="rv-key">Hjemmel</span>
          <span className="rv-val">
            {spec.refs.map((r) => <RefTag key={r.label} ref={r} />)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── PAGE ── */

export default function RegelverkPage() {
  const [activeTag, setActiveTag] = useState<string>('Fiskefartøy < 15 m');
  const [activeSection, setActiveSection] = useState<Section>('losleider');
  const [oversiktOpen, setOversiktOpen] = useState(true);
  const [solasOpen, setSolasOpen] = useState(false);

  const vessel = VESSELS.find((v) => v.tag === activeTag)!;

  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Regelverk &amp; Krav</div>
        <h1>Krav til leidere på norske fartøy</h1>
        <p>
          Gjeldende norske forskrifter for losleider, livbåtleider og redningsleider – fordelt på fartøystype
          med direkte lenker til Lovdata og de internasjonale standardene de bygger på.
        </p>
        <div className="subpage-nav-links">
          <a href="#oversikt" className="subpage-nav-link">Leidertyper</a>
          <a href="#krav" className="subpage-nav-link">Krav per fartøy</a>
          <a href="#lengde" className="subpage-nav-link">Leiderlengde</a>
          <a href="#vedlikehold" className="subpage-nav-link">Vedlikehold</a>
          <a href="#forskrifter" className="subpage-nav-link">Forskrifter</a>
        </div>
      </div>

      {/* Combined overview: distinction + intro */}
      <section className="rv-overview" id="oversikt">
        <div className="rv-overview-inner">
          <button className="rv-collapse-trigger" onClick={() => setOversiktOpen(v => !v)}>
            <div className="rv-distinction-header" style={{ margin: 0 }}>
              <AlertCircle size={18} strokeWidth={2} style={{ color: '#f5a623', flexShrink: 0 }} />
              <strong>Viktig: tre forskjellige leidere – tre forskjellige regelverk</strong>
            </div>
            <ChevronDown size={18} strokeWidth={2} className={`rv-collapse-chevron${oversiktOpen ? ' open' : ''}`} />
          </button>
          {oversiktOpen && <div className="rv-overview-grid">

            <div className="rv-overview-card">
              <div className="rv-overview-card-head">
                <div className="rv-overview-icon" style={{ color: 'var(--green)', borderColor: 'rgba(46,204,113,0.3)', background: 'rgba(46,204,113,0.08)' }}>
                  <Ruler size={20} strokeWidth={1.75} />
                </div>
                <div className="rv-overview-title" style={{ color: 'var(--green)' }}>Losleider / pilot ladder</div>
              </div>
              <p>Regulert under <em>navigasjonsregler</em> (SOLAS kap. V, reg. 23). Brukes for ombordstigning av los mens skipet er i bevegelse. Kjennetegnes av <strong>spreders</strong> – stiversteg plassert på 5. trinn fra bunnen, deretter maks hvert 9. trinn. Strenge geometriske krav (IMO A.1045(27) / ISO 799).</p>
              <div className="rv-overview-refs">
                <span>Fiskefartøy &lt; 15 m: FOR-2013-11-22-1404 § 41</span>
                <span>Fiskefartøy ≥ 15 m: FOR-2000-06-13-660 § 6-6</span>
                <span>Handelsskip &amp; offshore: FOR-2014-09-05-1157 §§ 25–28</span>
              </div>
            </div>

            <div className="rv-overview-card">
              <div className="rv-overview-card-head">
                <div className="rv-overview-icon" style={{ color: '#f5a623', borderColor: 'rgba(245,166,35,0.3)', background: 'rgba(245,166,35,0.08)' }}>
                  <Shield size={20} strokeWidth={1.75} />
                </div>
                <div className="rv-overview-title" style={{ color: '#f5a623' }}>Livbåtleider</div>
              </div>
              <p>Regulert under <em>redningsmiddelregler</em> (SOLAS kap. III / LSA-koden VI § 6.1.6). Brukes for evakuering til livbåt og redningsflåte mens skipet er stasjonært. Har <strong>ikke spreders</strong>. Permanent rigget ved hvert innstigningstasjon for livbåt og redningsflåte.</p>
              <div className="rv-overview-refs">
                <span>Fiskefartøy &lt; 15 m: FOR-2013-11-22-1404 kap. 4</span>
                <span>Fiskefartøy ≥ 15 m: FOR-2000-06-13-660 kap. 5</span>
                <span>Handelsskip &amp; offshore: FOR-2014-07-01-1019 → LSA VI § 6.1.6</span>
              </div>
            </div>

            <div className="rv-overview-card">
              <div className="rv-overview-card-head">
                <div className="rv-overview-icon" style={{ color: '#4a9eff', borderColor: 'rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.08)' }}>
                  <Waves size={20} strokeWidth={1.75} />
                </div>
                <div className="rv-overview-title" style={{ color: '#4a9eff' }}>Redningsleider / MOB-leider</div>
              </div>
              <p>Regulert under <em>redningsmiddelregler</em> (SOLAS kap. III, reg. 17). Brukes for å heve en person fra sjøen – Mann-Over-Bord. Har <strong>ikke spreders</strong>. På <strong>småbåter og fiskefartøy under 15 m</strong> er dette typisk det viktigste kravet til løs leider om bord.</p>
              <div className="rv-overview-refs">
                <span>Fiskefartøy &lt; 15 m: FOR-2013-11-22-1404 kap. 4</span>
                <span>Fiskefartøy ≥ 15 m: FOR-2000-06-13-660 kap. 5</span>
                <span>Handelsskip &amp; offshore: FOR-2014-07-01-1019 → SOLAS III/17</span>
              </div>
            </div>

          </div>}
        </div>
      </section>

      {/* Main requirements */}
      <section className="rv-main" id="krav">
        <div className="rv-controls">
          <h2 className="rv-section-title">Krav per fartøysklasse</h2>
          <div className="gallery-tabs" style={{ margin: 0 }}>
            {VESSEL_TAGS.map((t) => (
              <button
                key={t}
                className={`tab${activeTag === t ? ' active' : ''}`}
                onClick={() => setActiveTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary section tabs */}
        <div className="rv-section-tabs">
          {SECTIONS.map((s) => {
            return (
              <button
                key={s.id}
                className={`rv-section-tab${activeSection === s.id ? ' active' : ''}`}
                style={activeSection === s.id ? { borderColor: `${s.color}60`, color: s.color } : {}}
                onClick={() => setActiveSection(s.id)}
              >
                {s.id === 'losleider' && <Ruler size={14} strokeWidth={2} />}
                {s.id === 'livbat' && <Shield size={14} strokeWidth={2} />}
                {s.id === 'mob' && <Waves size={14} strokeWidth={2} />}
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="rv-cards">
          <div className="rv-card">
            <div className="rv-card-header">
              <div>
                <span className="rv-vessel-type">{vessel.tag}</span>
                <h3>{vessel.label}</h3>
                <p className="rv-card-meta">{vessel.loa} &mdash; {vessel.area}</p>
              </div>
              <div className="rv-badges">
                <StatusBadge ok={vessel.losleider.required} conditional={vessel.losleider.conditional} label="Losleider" />
                <StatusBadge ok={vessel.livbat.required} conditional={vessel.livbat.conditional} label="Livbåtleider" />
                <StatusBadge ok={vessel.mob.required} label="MOB-leider" />
              </div>
            </div>

            <div className="rv-card-body rv-card-body-single">
              {activeSection === 'losleider' && (
                <LadderBlock spec={vessel.losleider} color="var(--green)" title="Losleider / pilot ladder" />
              )}
              {activeSection === 'livbat' && (
                <LadderBlock spec={vessel.livbat} color="#f5a623" title="Livbåtleider" />
              )}
              {activeSection === 'mob' && (
                <LadderBlock spec={vessel.mob} color="#4a9eff" title="Redningsleider / MOB-leider" />
              )}
              <div className="rv-block rv-block-footer">
                <div className="rv-row">
                  <span className="rv-key">Inspeksjon</span>
                  <span className="rv-val">{vessel.inspFreq}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Length table */}
      <section className="rv-length-section" id="lengde" style={{ background: '#fff' }}>
        <div className="rv-length-inner">
          <div className="lbl" style={{ color: 'var(--navy)' }}>Veileder</div>
          <h2 className="stitle dark" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>
            Riktig leider&shy;lengde etter fribord
          </h2>
          <p style={{ color: '#567', marginBottom: '1.5rem', maxWidth: '600px', lineHeight: 1.7 }}>
            Fribordet er avstanden fra vannlinjen til dekket der leideren henger. Mål alltid
            fribordet i fartøyets <em>letteste</em> driftskondisjon – det gir den største
            nødvendige lengden.
          </p>
          <div className="rv-trim-callout">
            <button className="rv-collapse-trigger rv-collapse-trigger-sm" onClick={() => setSolasOpen(v => !v)}>
              <div className="rv-trim-callout-title" style={{ margin: 0 }}>
                <AlertCircle size={16} strokeWidth={2} />
                Korrekt lengdeberegning etter SOLAS V/23
              </div>
              <ChevronDown size={15} strokeWidth={2} className={`rv-collapse-chevron${solasOpen ? ' open' : ''}`} />
            </button>
            {solasOpen && <>
              <p>
                Det er ikke tilstrekkelig å måle fribordet ved kai. Leideren skal nå vannet i
                fartøyets <strong>letteste sjødyktige kondisjon</strong> (typisk: ingen last, 10&nbsp;%
                drivstoff og proviant, som angitt i stabilithetsboken) <em>og</em> samtidig tåle:
              </p>
              <ul>
                <li><strong>10° trim</strong> (for- eller akterlastighet)</li>
                <li><strong>20° slagside (list)</strong></li>
              </ul>
              <p>
                I praksis betyr dette at nødvendig leiderlengde ofte er <strong>0,5–2&nbsp;m lenger</strong>{' '}
                enn et enkelt fribordssmål ved kai tilsier. Beregningen skal dokumenteres fra
                stabilithetsboken. Feil beregnet lengde er en av de hyppigst registrerte avvikene
                ved Port State Control-inspeksjoner.
              </p>
            </>}
          </div>
          <div className="rv-table-wrap">
            <table className="rv-table">
              <thead>
                <tr>
                  <th>Fribord</th>
                  <th>Typisk fartøy</th>
                  <th>Anbefalt min. leider</th>
                  <th>Antall trinn (ca.)</th>
                  <th>Merknad</th>
                </tr>
              </thead>
              <tbody>
                {LENGTH_TABLE.map((row, i) => (
                  <tr key={i}>
                    <td><strong>{row.freeboard}</strong></td>
                    <td>{row.typical}</td>
                    <td className="rv-td-highlight">{row.minLength}</td>
                    <td>{row.steps}</td>
                    <td className="rv-td-note">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rv-table-note">
            Tabellen er veiledende. De eksakte lovkravene til lengde følger av de respektive
            forskriftene for din fartøysklasse. Kontakt oss for nøyaktig beregning.
          </p>
        </div>
      </section>

      {/* Maintenance & certification */}
      <section className="rv-maint-section" id="vedlikehold">
        <div className="rv-maint-inner">
          <div className="lbl">Drift &amp; levetid</div>
          <h2 className="stitle" style={{ marginBottom: '0.5rem' }}>Vedlikehold og sertifisering</h2>
          <p className="sub" style={{ marginBottom: '2.5rem', maxWidth: '560px' }}>
            En leider i forskriftsmessig stand er like mye et dokumentasjonskrav som et fysisk krav.
            Her er de viktigste reglene for vedlikehold, kontroll og levetid.
          </p>
          <div className="rv-maint-grid">
            {MAINTENANCE.map((card) => (
              <div className="rv-maint-card" key={card.title}>
                <div className="rv-maint-card-head">
                  <div className="rv-maint-icon" style={{ color: card.color, borderColor: `${card.color === 'var(--green)' ? 'rgba(46,204,113,0.3)' : card.color === '#f5a623' ? 'rgba(245,166,35,0.3)' : 'rgba(74,158,255,0.3)'}`, background: `${card.color === 'var(--green)' ? 'rgba(46,204,113,0.1)' : card.color === '#f5a623' ? 'rgba(245,166,35,0.1)' : 'rgba(74,158,255,0.1)'}` }}>
                    <card.icon size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="rv-maint-title">{card.title}</div>
                    <div className="rv-maint-rule">{card.rule}</div>
                  </div>
                </div>
                <ul className="rv-maint-list">
                  {card.body.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulations reference */}
      <section className="rv-length-section" id="forskrifter">
        <div className="rv-length-inner" style={{ maxWidth: '1100px' }}>
          <div className="lbl" style={{ color: 'var(--navy)' }}>Forskrifter</div>
          <h2 className="stitle dark" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>
            Gjeldende norske forskrifter
          </h2>
          <p style={{ color: '#567', marginBottom: '2.5rem', maxWidth: '640px' }}>
            De fire forskriftene som til sammen dekker alle norske fartøystyper. Klikk for å åpne
            fullteksten på Lovdata.
          </p>
          <div className="rv-reg-grid">
            {REGS.map((r) => (
              <a
                key={r.name}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rv-reg-card"
              >
                <div className="rv-reg-card-top">
                  <div className="rv-cert-icon" style={{ color: r.color, borderColor: `${r.color}40`, background: `${r.color}12`, width: '2.6rem', height: '2.6rem', marginBottom: 0 }}>
                    <r.icon size={18} strokeWidth={1.5} />
                  </div>
                  <ArrowUpRight size={16} strokeWidth={2} style={{ color: '#aab', marginLeft: 'auto' }} />
                </div>
                <div className="rv-reg-name">{r.name}</div>
                <div className="rv-reg-short">{r.shortName}</div>
                <p className="rv-reg-desc">{r.desc}</p>
                <div className="rv-reg-refs">
                  <span>Losleider: <strong>{r.losRef}</strong></span>
                  <span>Livbåtleider: <strong>{r.livbatRef}</strong></span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="rv-cta-section">
        <div className="rv-cta-inner">
          <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Usikker?</div>
          <h2 className="stitle" style={{ textAlign: 'center', color: '#fff' }}>
            Få en gratis kravvurdering
          </h2>
          <p className="sub" style={{ textAlign: 'center', margin: '0.75rem auto 2.5rem', maxWidth: '520px' }}>
            Send oss fartøyets navn og størrelse, så avklarer vi hvilke leidere du trenger og
            om ditt nåværende system er i samsvar med gjeldende forskrifter.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/#kontakt" className="btn-primary" style={{ display: 'inline-flex', border: 'none' }}>
              Be om vurdering →
            </a>
            <a href="/faq" className="btn-ghost" style={{ display: 'inline-flex' }}>
              Se vanlige spørsmål
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
