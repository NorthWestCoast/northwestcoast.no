/**
 * Felles HTML-oppsett for all e-post fra NorthWestCoast.
 *
 * Fila har bevisst ingen importer: den brukes både av appen (lib/mail/templates)
 * og av scripts/build-auth-mail.mts, som lager innloggingsmalene til Supabase
 * med plain `node`. Slik ser e-postene fra appen og fra Supabase like ut.
 *
 * To regler holder malene trygge:
 *  1. Alt som settes inn med html`…` escapes. Bare verdier som selv kommer fra
 *     html`…` (eller raw()) slipper gjennom som HTML. Det er dermed ikke mulig
 *     å glemme å escape et navn, en kommentar eller et fartøysnavn.
 *  2. Lenker og knapper peker bare på adresser vi selv har bygget. Fritekst fra
 *     skjemaer blir aldri til en lenke, se unlink().
 *
 * E-postklienter er gamle nettlesere: oppsettet er tabeller med stil rett på
 * elementene, uten eksterne skrifter og uten bilder som bærer innhold.
 */

/** Ferdig HTML som ikke skal escapes en gang til. */
export class Safe {
  // Uten parameter-egenskap, så fila også kan lastes av plain node.
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const raw = (value: string) => new Safe(value);

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const esc = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

function render(value: unknown): string {
  if (value instanceof Safe) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  if (value === null || value === undefined || value === false) return '';
  return esc(value);
}

/** Mal-tagg som escaper alt som settes inn, bortsett fra Safe-verdier. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Safe {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += render(values[i]) + strings[i + 1];
  return new Safe(out);
}

/** Tekst med linjeskift bevart. */
export const multiline = (text: string): Safe =>
  new Safe(esc(text).replace(/\r?\n/g, '<br>'));

/**
 * Emnefelt og andre enlinjefelt: linjeskift, kontrolltegn og usynlige
 * formattegn (retningsbytte, null-bredde) ut, og en øvre lengde, så ingenting
 * fra et skjema kan bryte ut av feltet eller skjule hva som står der.
 */
export const oneLine = (value: unknown, max = 160): string =>
  Array.from(
    String(value ?? '')
      .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, max)
    .join('')
    .trim();

const ZWSP = String.fromCharCode(0x200b);

/**
 * Gjør at fritekst ikke blir til lenker hos mottakeren.
 *
 * E-postklienter gjør nettadresser, domener og e-postadresser i ren tekst
 * klikkbare av seg selv. Et usynlig mellomrom etter punktum, kolon, krøllalfa
 * og skråstrek mellom to tegn bryter den gjenkjenningen, uten at teksten ser
 * annerledes ut. Brukes på alt som er skrevet av andre og sendes til en
 * adresse de selv har valgt.
 */
export const unlink = (text: string): string =>
  text.replace(/([\p{L}\p{N}])([.:@/])(?=[\p{L}\p{N}/])/gu, `$1$2${ZWSP}`);

/**
 * Navn til hilsenen i en kvittering som går til en adresse vi ikke kjenner.
 * Bare bokstaver, mellomrom, bindestrek og apostrof, og høyst fire ord: da
 * kan «navnet» verken inneholde en lenke, et telefonnummer eller en setning.
 * Alt annet gir en hilsen uten navn.
 */
export function safeName(name: string | null | undefined): string {
  const value = oneLine(name, 40);
  if (!/^\p{L}[\p{L} '’-]{1,39}$/u.test(value)) return '';
  if (value.split(' ').length > 4) return '';
  return value;
}

/**
 * Kort betegnelse skrevet av andre (fartøysnavn, selskapsnavn) som skal med
 * i en e-post: én linje, begrenset tegnsett, og uten at noe blir til en
 * lenke. Tom streng når verdien inneholder noe annet.
 */
export function safeLabel(value: string | null | undefined, max = 60): string {
  const label = oneLine(value, max);
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'’&()/+-]*$/u.test(label)) return '';
  return unlink(label);
}

/** Bare adresser vi har bygget selv slipper inn i href. */
const SAFE_URL = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/]|\{\{ \.SiteURL \}\}\/?)/;
const safeUrl = (url: string): string => (SAFE_URL.test(url) ? url : '#');

/* ── Farger og skrift ─────────────────────────────────────────────────────── */

export const COLOR = {
  navy: '#0a1628',
  ink: '#16202e',
  muted: '#5b6675',
  faint: '#7a7468',
  line: '#e2ddd3',
  paper: '#ffffff',
  page: '#f2ece4',
  panel: '#f8f5ef',
  green: '#2ecc71',
  // Samme rødbrune som «COAST» og linjene i logoen.
  burgundy: '#7f2d36',
} as const;

const SANS = "Arial, Helvetica, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "'Courier New', Courier, monospace";

/* ── Byggeklosser ─────────────────────────────────────────────────────────── */

type Content = string | Safe;
const inner = (content: Content): Safe => (content instanceof Safe ? content : multiline(content));

/** Vanlig avsnitt. Ren tekst escapes og beholder linjeskift. */
export const p = (content: Content): Safe =>
  html`<p style="margin:0 0 16px;font:400 16px/1.55 ${raw(SANS)};color:${COLOR.ink};">${inner(content)}</p>`;

/** Mindre, dempet avsnitt til forbehold og praktiske opplysninger. */
export const small = (content: Content): Safe =>
  html`<p style="margin:0 0 14px;font:400 14px/1.5 ${raw(SANS)};color:${COLOR.muted};">${inner(content)}</p>`;

export const strong = (content: Content): Safe => html`<strong>${inner(content)}</strong>`;

/** Understreket lenke i løpende tekst. Adressen skal være en vi har bygget selv. */
export const link = (label: string, url: string): Safe =>
  html`<a href="${safeUrl(url)}" style="color:${COLOR.navy};text-decoration:underline;">${label}</a>`;

/** Mellomtittel inne i e-posten. */
export const h2 = (content: Content): Safe =>
  html`<h2 style="margin:26px 0 10px;font:700 15px/1.4 ${raw(SANS)};color:${COLOR.navy};">${inner(content)}</h2>`;

/**
 * Hovedknappen. Bygget som en tabellcelle med bakgrunn, så den også er en
 * knapp i Outlook, og med mørk tekst på grønt som på nettsiden.
 */
export const button = (label: string, url: string): Safe => html`
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;">
  <tr>
    <td bgcolor="${COLOR.green}" style="background:${COLOR.green};border-radius:3px;">
      <a href="${safeUrl(url)}" style="display:inline-block;padding:13px 26px;font:700 16px/1.2 ${raw(SANS)};color:${COLOR.navy};text-decoration:none;border-radius:3px;">${label}</a>
    </td>
  </tr>
</table>`;

/** Adressen i klartekst under en knapp, for den som ikke får klikket. */
export const fallbackUrl = (intro: string, url: string): Safe => html`
<p style="margin:0 0 16px;font:400 13px/1.5 ${raw(SANS)};color:${COLOR.muted};">${intro}<br>
<a href="${safeUrl(url)}" style="color:${COLOR.muted};text-decoration:underline;word-break:break-all;">${url}</a></p>`;

/** Engangskode, satt stort og med luft mellom tegnene. */
export const code = (value: Content): Safe => html`
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">
  <tr>
    <td style="padding:12px 20px;background:${COLOR.panel};border:1px solid ${COLOR.line};border-radius:3px;font:700 26px/1.2 ${raw(MONO)};letter-spacing:4px;color:${COLOR.navy};">${inner(value)}</td>
  </tr>
</table>`;

/** Opplysninger som ledetekst og verdi, én per linje. Tomme verdier hoppes over. */
export function details(rows: Array<[label: string, value: Content | null | undefined]>): Safe {
  const shown = rows.filter((row): row is [string, Content] => row[1] !== null && row[1] !== undefined && row[1] !== '');
  if (shown.length === 0) return raw('');
  return html`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-top:1px solid ${COLOR.line};">
  ${shown.map(
    ([label, value]) => html`<tr>
    <td valign="top" width="38%" style="padding:9px 12px 9px 0;border-bottom:1px solid ${COLOR.line};font:400 14px/1.45 ${raw(SANS)};color:${COLOR.muted};">${label}</td>
    <td valign="top" style="padding:9px 0;border-bottom:1px solid ${COLOR.line};font:400 15px/1.45 ${raw(SANS)};color:${COLOR.ink};">${inner(value)}</td>
  </tr>`,
  )}
</table>`;
}

/** Rolig, innrammet felt til en kommentar eller et forbehold. */
export const note = (content: Content): Safe => html`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;">
  <tr>
    <td style="padding:13px 16px;background:${COLOR.panel};border-left:3px solid ${COLOR.line};font:400 15px/1.5 ${raw(SANS)};color:${COLOR.ink};">${inner(content)}</td>
  </tr>
</table>`;

export type TableLine = {
  title: string;
  /** Linjer under tittelen: produktnummer, trinn, skapet som følger med. */
  sub?: string[];
  /** Høyrestilt: sum eller «pris på forespørsel». */
  amount: string;
};

/** Bestillingslinjer med sum til høyre og en totalrad nederst. */
export function lineTable(lines: TableLine[], total?: { label: string; amount: string; hint?: string }): Safe {
  return html`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border-top:1px solid ${COLOR.line};">
  ${lines.map(
    (line) => html`<tr>
    <td valign="top" style="padding:11px 12px 11px 0;border-bottom:1px solid ${COLOR.line};font:400 15px/1.45 ${raw(SANS)};color:${COLOR.ink};">
      ${line.title}${(line.sub ?? []).map(
        (sub) => html`<br><span style="font-size:13px;color:${COLOR.muted};">${sub}</span>`,
      )}
    </td>
    <td valign="top" align="right" style="padding:11px 0;border-bottom:1px solid ${COLOR.line};font:400 15px/1.45 ${raw(SANS)};color:${COLOR.ink};white-space:nowrap;">${line.amount}</td>
  </tr>`,
  )}
  ${total
    ? html`<tr>
    <td valign="top" style="padding:12px 12px 0 0;font:700 15px/1.45 ${raw(SANS)};color:${COLOR.navy};">${total.label}${
      total.hint ? html`<br><span style="font-weight:400;font-size:13px;color:${COLOR.muted};">${total.hint}</span>` : ''
    }</td>
    <td valign="top" align="right" style="padding:12px 0 0;font:700 15px/1.45 ${raw(SANS)};color:${COLOR.navy};white-space:nowrap;">${total.amount}</td>
  </tr>`
    : ''}
</table>`;
}

/* ── Rammen ───────────────────────────────────────────────────────────────── */

export type Brand = {
  /**
   * Nettstedet som sender e-posten, uten skråstrek til slutt. Logoen hentes
   * herfra. I Supabase-malene er dette {{ .SiteURL }}.
   */
  siteUrl: string;
  /** Adressen som står i bunnteksten, og som logoen og bunnteksten lenker til. */
  homeUrl: string;
  phone: string;
  email: string;
};

export type EmailShell = {
  lang?: 'no' | 'en';
  /** Står i <title>. Samme som emnefeltet. */
  title: string;
  /** Teksten innboksen viser etter emnet. */
  preheader: string;
  heading: string;
  body: Safe | Safe[];
  /** Hvorfor mottakeren får e-posten. Står nederst, utenfor selve kortet. */
  reason: string;
  brand: Brand;
};

const FOOTER = {
  no: { phone: 'Telefon', address: 'Postboks 79, 6281 Søvik', org: 'Org.nr. 998 196 159' },
  en: { phone: 'Phone', address: 'PO Box 79, 6281 Søvik, Norway', org: 'Org. no. 998 196 159' },
} as const;

/** Setter innholdet inn i den felles rammen og gir et komplett HTML-dokument. */
export function shell(args: EmailShell): string {
  const lang = args.lang ?? 'no';
  const t = FOOTER[lang];
  const { siteUrl, homeUrl, phone, email } = args.brand;
  const tel = phone.replace(/[^+\d]/g, '');

  return html`<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'nb'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${args.title}</title>
<style>
  @media only screen and (max-width: 620px) {
    .nwc-wrap { width: 100% !important; }
    .nwc-pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${args.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.page};">
  <tr>
    <td align="center" style="padding:28px 12px 12px;">
      <table role="presentation" class="nwc-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${COLOR.paper};border:1px solid ${COLOR.line};">
        <tr>
          <td class="nwc-pad" bgcolor="${COLOR.navy}" style="background:${COLOR.navy};padding:22px 36px;border-bottom:3px solid ${COLOR.burgundy};">
            <a href="${homeUrl}" style="text-decoration:none;"><img src="${siteUrl}/images/logo/NY-logo.png" width="163" height="40" alt="NorthWestCoast" style="display:block;border:0;outline:none;font:400 17px/40px ${raw(SERIF)};color:#ffffff;"></a>
          </td>
        </tr>
        <tr>
          <td class="nwc-pad" style="padding:34px 36px 14px;">
            <h1 style="margin:0 0 18px;font:400 25px/1.3 ${raw(SERIF)};color:${COLOR.navy};">${args.heading}</h1>
            ${args.body}
          </td>
        </tr>
        <tr>
          <td class="nwc-pad" style="padding:18px 36px 24px;border-top:1px solid ${COLOR.line};font:400 13px/1.6 ${raw(SANS)};color:${COLOR.muted};">
            <strong style="color:${COLOR.navy};">NorthWestCoast AS</strong><br>
            ${t.address} · ${t.org}<br>
            ${t.phone} <a href="tel:${tel}" style="color:${COLOR.muted};text-decoration:underline;">${phone}</a> ·
            <a href="mailto:${email}" style="color:${COLOR.muted};text-decoration:underline;">${email}</a> ·
            <a href="${homeUrl}" style="color:${COLOR.muted};text-decoration:underline;">${homeUrl.replace(/^https?:\/\//, '')}</a>
          </td>
        </tr>
      </table>
      <table role="presentation" class="nwc-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td class="nwc-pad" style="padding:14px 36px 24px;font:400 12px/1.5 ${raw(SANS)};color:${COLOR.faint};">${args.reason}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`.value;
}
