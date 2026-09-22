/** Delt FAQ-innhold – brukes av FAQ-seksjonen, /faq og FAQPage-JSON-LD. */
export type Faq = { q: string; a: string; category: string };

export const FAQS: Faq[] = [
  {
    q: 'Er stigen godkjent for norske skip?',
    a: 'Ja, Argostep Entrings- og Livbåtleider er testet og godkjent etter ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet for norske fartøy.',
    category: 'Sertifisering',
  },
  {
    q: 'Hvilke lengder er tilgjengelige?',
    a: 'Argostep Livbåtleider leveres som standard lengder fra 2 - 15 meter. Ta kontakt ved andre behov så skreddersyr vi en pakke for deg.',
    category: 'Produkt',
  },
  {
    q: 'Hvor lenge varer en leider?',
    a: 'Designet for lang levetid med utskiftbare komponenter. Ved oppbevaring i skap fra Northwestcoast vil levetiden øke betraktlig.',
    category: 'Produkt',
  },
  {
    q: 'Hvordan monterer jeg leideren?',
    a: 'Argostep er designet for enkel montering og demontering uten spesialverktøy. Leideren monteres på samme måte som den tradisjonelle leideren.',
    category: 'Montering',
  },
  {
    q: 'Hva er leveringstiden for Argostep?',
    a: 'Leveringstiden varierer avhengig av spesifikasjoner. Kontakt oss for et nøyaktig tilbud og estimert leveringstid for ditt fartøy.',
    category: 'Leveranse',
  },
  {
    q: 'Av hvilket materiale er leideren laget?',
    a: 'Trinnene og festene er laget av sprøytestøpt glassfiberarmert plast – et materiale som kombinerer lav vekt, høy styrke og utmerket korrosjonsbestandighet i saltvannsmiljø.',
    category: 'Produkt',
  },
  {
    q: 'Hva veier en standard Argostep?',
    a: 'Alle vektene for Argostep leider finner du under Bestill nå.',
    category: 'Produkt',
  },
  {
    q: 'Kan jeg montere leideren selv?',
    a: 'Ja, Argostep er konstruert for selvmontering. Medfølgende monteringsveiledning og klikk-koblingssystemet gjør det mulig å montere leideren uten fagfolk.',
    category: 'Montering',
  },
  {
    q: 'Tilbyr dere reservedeler og service?',
    a: 'Ja. Et av hovedfordelene med Argostep er det modulære systemet – enkelttrinn og komponenter kan bestilles separat. Kontakt oss for reservedeler eller serviceavtale.',
    category: 'Leveranse',
  },
];
