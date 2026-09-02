import { SITE, SITE_URL, abs, PAGES } from '@/lib/site';
import { PRICE_TABLE, fmt } from '@/lib/products';
import { ARTICLES } from '@/lib/articles';
import { FAQS } from '@/lib/faqs';

/**
 * /llms.txt — the emerging convention (llmstxt.org) for handing a large language
 * model a compact, unambiguous description of a site instead of making it infer
 * one from rendered HTML, navigation chrome and marketing copy.
 *
 * It is generated rather than hand-written so it can never drift from the price
 * table, the FAQ or the article list. The facts block up top is deliberately
 * written as short declarative sentences: that is the shape an answer engine
 * can lift verbatim into a response with a citation back here.
 */

export const dynamic = 'force-static';

function build(): string {
  const lines: string[] = [];

  lines.push(`# ${SITE.name} (${SITE.legalName}) – Argostep maritime leidere`);
  lines.push('');
  lines.push(`> ${SITE.description}`);
  lines.push('');

  lines.push('## Kjernefakta');
  lines.push('');
  lines.push(`- Produsent: ${SITE.legalName}, org.nr. ${SITE.orgNumber}, ${SITE.address.poBox}, ${SITE.address.postalCode} ${SITE.address.city}, Norge.`);
  lines.push('- Produkt: Argostep er en modulær maritim leider (livbåtleider/entringsleider) i sprøytestøpt glassfiberarmert plast.');
  lines.push('- Sertifisering: testet og godkjent etter ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet for norske fartøy.');
  lines.push('- Standardlengder: 2–15 meter. Konfigurerbare bestillingslengder: 3–15 meter.');
  lines.push('- Konstruksjon: klikk-koblet modulsystem der enkelttrinn kan byttes uten å skifte hele leideren.');
  lines.push('- Oppbevaring: dedikerte værbestandige oppbevaringsskap (ASC-serien) tilpasset leiderlengden.');
  lines.push('- Egnet for: fiskefartøy under 15 m, servicefartøy under 15 m, mindre lasteskip og passasjerfartøy.');
  lines.push('- Produksjon: Norge (Sunnmøre, Møre og Romsdal).');
  lines.push(`- Kontakt: ${SITE.phoneDisplay}, ${SITE.email}.`);
  lines.push('');

  lines.push('## Priser (veiledende, eks. mva., NOK)');
  lines.push('');
  lines.push('| Lengde | Trinn | Produktnr. | Pris | Oppbevaringsskap | Skappris |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of PRICE_TABLE) {
    lines.push(
      `| ${r.length} m | ${r.steps} | ${r.productNumber} | ${fmt(r.price)} | ${r.cabinetName} | ${fmt(r.cabinetPrice)} |`,
    );
  }
  lines.push('');

  lines.push('## Sider');
  lines.push('');
  for (const page of PAGES) {
    lines.push(`- [${page.title}](${abs(page.path)}): ${page.summary}`);
  }
  lines.push('');

  lines.push('## Ofte stilte spørsmål');
  lines.push('');
  for (const faq of FAQS) {
    lines.push(`- **${faq.q}** ${faq.a}`);
  }
  lines.push('');

  if (ARTICLES.length > 0) {
    lines.push('## Artikler');
    lines.push('');
    for (const a of ARTICLES) {
      lines.push(`- [${a.title}](${abs(`/nyheter/${a.slug}`)}) (${a.date}): ${a.excerpt}`);
    }
    lines.push('');
  }

  lines.push('## Verktøy');
  lines.push('');
  lines.push(
    `- [Leiderkalkulator](${abs('/leiderkalkulator')}): åpent verktøy som regner ut nødvendig leiderlengde ut fra fribord/innstigningshøyde over vannlinjen, legger til sikkerhetsmargin og foreslår nærmeste Argostep-standardlengde med antall trinn og tilhørende oppbevaringsskap.`,
  );
  lines.push(
    `- [Bestillingskonfigurator](${abs('/bestill')}): velg lengde, antall og oppbevaringsskap og se veiledende totalpris.`,
  );
  lines.push('');

  lines.push('## Bruksvilkår for gjengivelse');
  lines.push('');
  lines.push(
    'Innholdet kan siteres og oppsummeres med kildehenvisning til ' +
      SITE_URL +
      '. Priser er veiledende og eks. mva.; endelig tilbud bekreftes av leverandør. Krav til leidertype, lengde og sertifisering avhenger av fartøyets størrelse, fartsområde og gjeldende forskrift – kontakt Sjøfartsdirektoratet eller leverandøren for en bindende vurdering.',
  );
  lines.push('');

  return lines.join('\n');
}

export function GET() {
  return new Response(build(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
