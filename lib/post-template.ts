/**
 * Malen og skriveveiledningen som kan lastes ned under Nyheter i admin.
 * Formatet er beskrevet i lib/post-markdown.ts; endres det, må tekstene her
 * følge med.
 */

export const TEMPLATE_FILENAME = 'nyhet-mal.md';
export const GUIDE_FILENAME = 'nyhet-veiledning-for-ai.md';

export const POST_TEMPLATE = `---
tittel: Ny leiderkasse på plass
title: New ladder case in place
adresse: ny-leiderkasse
dato: 2026-08-30
stikkord: Nyheter
tag: News
ingress: Én eller to setninger som vises på nyhetskortet og i søkeresultater.
excerpt: One or two sentences shown on the news card and in search results.
forsidebilde: forsidebilde.jpg
---

Første avsnitt sier det viktigste: hva som er nytt, og hvem det gjelder.

## Mellomtittel

Et avsnitt med **utheving** og en [lenke](https://northwestcoast.no/produkt).

:::bilder
bilde-1.jpg | Bildetekst til det første bildet
bilde-2.jpg | Bildetekst til det andre bildet
:::

- Et punkt
- Et punkt til

=== English ===

The first paragraph says what matters most: what is new, and who it concerns.

## Subheading

A paragraph with **emphasis** and a [link](https://northwestcoast.no/en/produkt).

:::bilder
bilde-1.jpg | Caption for the first image
bilde-2.jpg | Caption for the second image
:::

- A point
- Another point
`;

export const AI_GUIDE = `# Veiledning: nyhetsinnlegg til northwestcoast.no

Gi denne fila til en AI-assistent (for eksempel Claude) sammen med det saken skal handle om og bildene. Be om ei ferdig .md-fil etter formatet under. Last opp fila og bildene samtidig under Nyheter i admin med «Importer .md». Se over forhåndsvisningen før du lagrer.

## Til AI-assistenten

Du skriver et nyhetsinnlegg for NorthWestCoast, som leverer Argostep-leidere og oppbevaringsskap til fiske- og sjøfartsnæringen. Svar med innholdet i én .md-fil, nøyaktig i formatet under, og ingenting annet.

### Fakta og tone

- Bruk bare fakta du har fått. Ikke finn på tall, priser, kunder, fartøy, sitater eller datoer. Mangler noe viktig, skriv [MANGLER: …] i teksten.
- Skriv navnet som «NorthWestCoast», i ett ord.
- Norsk bokmål, saklig og konkret. Korte avsnitt, gjerne 250–500 ord. Ingen overdrivelser, utropstegn eller emojier.
- Det første avsnittet sier det viktigste. 2–4 mellomtitler holder.
- Den engelske teksten er en god oversettelse av den norske, ikke en ny sak.

### Feltene øverst

Mellom de to «---»-linjene, ett felt per linje, uten anførselstegn:

- tittel / title: norsk og engelsk tittel, under 80 tegn
- adresse: siste del av nettadressen, små bokstaver og bindestrek (æ → ae, ø → o, å → a)
- dato: publiseringsdato som 2026-08-30. Utelates hvis den ikke er gitt.
- stikkord / tag: for eksempel Nyheter / News
- ingress / excerpt: én eller to setninger, under 300 tegn
- forsidebilde: filnavnet på bildet som skal stå øverst

### Brødteksten

Bare dette er lov:

- blank linje mellom avsnitt
- «## » først på linja for mellomtittel (aldri «# »)
- «- » først på linja for punktliste
- **fet** for utheving
- [tekst](https://…) for lenker
- bildeblokker, se under

Ikke bruk HTML, tabeller, nummererte lister, sitatblokker eller ![bilde](…). Det vises ikke.

### Bilder

Bildene vises som et lysbildeshow der blokken står i teksten:

\`\`\`
:::bilder
filnavn.jpg | Bildetekst
annet-bilde.jpg | Bildetekst
:::
\`\`\`

- Bruk nøyaktig de filnavnene du har fått, og bare dem. Står det allerede bilder i teksten (for eksempel «bibliotek/…»), skal de stå uendret.
- Hvert bilde får en kort bildetekst som sier hva bildet viser. Den leses også opp for blinde.
- Den engelske teksten skal ha den samme blokken med de samme bildene, med engelske bildetekster.
- Én blokk per innlegg holder som regel. Høyst 10 bilder.

### Engelsk

Den engelske teksten kommer etter linja «=== English ===», med samme oppbygging.

## Eksempel

\`\`\`markdown
${POST_TEMPLATE.trim()}
\`\`\`
`;
