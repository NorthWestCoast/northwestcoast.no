/**
 * Portalen på eget vertsnavn: vertsreglene i next.config.mjs og lenkene i
 * lib/site.ts.
 *
 * Reglene kjøres gjennom de samme funksjonene Next-serveren bruker til å
 * treffe kilde, vertsnavn og mål (next/dist/…). Det er interne moduler: flytter
 * en oppgradering av Next dem, er det testen som må rettes, ikke reglene.
 *
 * Kjør: node tests/portal-hosts.test.mts
 */
import pathMatch from 'next/dist/shared/lib/router/utils/path-match.js';
import destination from 'next/dist/shared/lib/router/utils/prepare-destination.js';
import redirectStatus from 'next/dist/lib/redirect-status.js';

const SITE = 'https://northwestcoast.no';
const PORTAL = 'https://portal.northwestcoast.no';
const SUPABASE = 'https://abc.supabase.co';
const PREVIEW = 'northwestcoast-no-git-x.vercel.app';

let failed = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { failed += 1; console.error(`FEILET: ${what}`); }
};

type Rule = {
  source: string;
  destination?: string;
  permanent?: boolean;
  statusCode?: number;
  has?: { type: string; key?: string; value?: string }[];
  missing?: { type: string; key?: string; value?: string }[];
  headers?: { key: string; value: string }[];
};
type Config = { redirects: () => Promise<Rule[]>; headers: () => Promise<Rule[]> };

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** Reglene som treffer forespørselen, i rekkefølge, med parameterne fra kilden. */
function matching(rules: Rule[], host: string, url: string, redirect: boolean) {
  const { pathname, searchParams } = new URL(url, 'http://x');
  const query = Object.fromEntries(searchParams);
  const request = { headers: { host } } as unknown as Parameters<typeof destination.matchHas>[0];

  return rules.flatMap((rule) => {
    const params = pathMatch.getPathMatch(rule.source, {
      strict: true,
      removeUnnamedParams: true,
      // Som serveren: videresendinger rører aldri /_next, og tåler en skråstrek til slutt.
      regexModifier: (regex: string) => redirectStatus.modifyRouteRegex(regex, redirect ? ['/_next'] : undefined),
    })(pathname);
    if (!params) return [];
    const has = destination.matchHas(request, query, (rule.has ?? []) as never, (rule.missing ?? []) as never);
    return has ? [{ rule, params: { ...params, ...has }, query }] : [];
  });
}

/** Svaret på en forespørsel: «307 <adresse>», eller null når ingen videresending treffer. */
async function redirectFor(config: Config, host: string, url: string): Promise<string | null> {
  const [hit] = matching(await config.redirects(), host, url, true);
  if (!hit) return null;
  const { parsedDestination: to } = destination.prepareDestination({
    appendParamsToQuery: false,
    destination: hit.rule.destination ?? '',
    params: hit.params,
    query: hit.query,
  });
  const search = new URLSearchParams(to.query as Record<string, string>).toString();
  const origin = to.hostname ? `${to.protocol}//${to.hostname}${to.port ? `:${to.port}` : ''}` : '';
  return `${hit.rule.statusCode ?? (hit.rule.permanent ? 308 : 307)} ${origin}${to.pathname}${search ? `?${search}` : ''}${to.hash ?? ''}`;
}

/** Hodene et svar får. Samme nøkkel to ganger betyr at to regler traff. */
async function headersFor(config: Config, host: string, url: string) {
  return matching(await config.headers(), host, url, false).flatMap((hit) => hit.rule.headers ?? []);
}

const single: Config = (await import('../next.config.mjs')).default;

// ── Én adresse: ingen vertsregler ───────────────────────────────────────────
for (const env of [
  { NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_PORTAL_URL: undefined },
  { NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_PORTAL_URL: PORTAL },
  { NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_PORTAL_URL: undefined },
  { NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_PORTAL_URL: `${SITE}/` },
]) {
  setEnv(env);
  const label = JSON.stringify(env);
  const hostRules = [...(await single.redirects()), ...(await single.headers())]
    .filter((rule) => [...(rule.has ?? []), ...(rule.missing ?? [])].some((item) => item.type === 'host'));
  ok(hostRules.length === 0, `ingen vertsregler med ${label}`);
  ok((await single.headers()).length === 1, `én regel for hoder med ${label}`);
  for (const host of ['northwestcoast.no', 'portal.northwestcoast.no', 'localhost:3000']) {
    ok(await redirectFor(single, host, '/minside') === null, `/minside blir stående på ${host} med ${label}`);
    ok(await redirectFor(single, host, '/produkter') === null, `/produkter blir stående på ${host} med ${label}`);
    ok(await redirectFor(single, host, '/?code=x') === '307 /auth/callback?code=x', `/?code= går til /auth/callback på ${host}`);
    const headers = await headersFor(single, host, '/logg-inn');
    ok(!headers.some((h) => h.key === 'X-Robots-Tag'), `ingen X-Robots-Tag på ${host} med ${label}`);
    ok(headers.filter((h) => h.key === 'Content-Security-Policy').length === 1, `én CSP på ${host} med ${label}`);
  }
}

// ── Portalen på eget vertsnavn ──────────────────────────────────────────────
setEnv({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_PORTAL_URL: PORTAL, NEXT_PUBLIC_SUPABASE_URL: SUPABASE, NODE_ENV: 'production' });
const split = single;

const site = 'northwestcoast.no';
const portal = 'portal.northwestcoast.no';
const expected: [host: string, url: string, answer: string | null][] = [
  // Nettstedet: bare portalstiene sendes videre, med spørringen.
  [site, '/', null],
  [site, '/produkter', null],
  [site, '/en', null],
  [site, '/personvern', null],
  [site, '/api/vessels?q=test', null],
  [site, '/api/newsletter/confirm?t=0123456789abcdef0123456789abcdef', null],
  [site, '/images/logo/NY-logo.png', null],
  [site, '/robots.txt', null],
  [site, '/losning', null],
  [site, '/logg-inn', `307 ${PORTAL}/logg-inn`],
  [site, '/logg-inn?neste=%2Fminside%2Fleider%2Fx', `307 ${PORTAL}/logg-inn?neste=%2Fminside%2Fleider%2Fx`],
  [site, '/minside', `307 ${PORTAL}/minside`],
  [site, '/admin/bestillinger', `307 ${PORTAL}/admin/bestillinger`],
  [site, '/produksjon/ferdige', `307 ${PORTAL}/produksjon/ferdige`],
  [site, '/auth/callback?code=x', `307 ${PORTAL}/auth/callback?code=x`],
  [site, '/auth/confirm?token_hash=x&type=email', `307 ${PORTAL}/auth/confirm?token_hash=x&type=email`],
  [site, '/los/abc', `307 ${PORTAL}/los/abc`],
  [site, '/sertifikat/abc', `307 ${PORTAL}/sertifikat/abc`],
  [site, '/?code=x', '307 /auth/callback?code=x'],
  [site, '/no/products', '308 /produkter'],
  [site, '/no/login', '308 /logg-inn'],
  [site, '/no/produkter', '301 /produkter'],

  // Portalen: svarer på sitt eget, resten hører til nettstedet.
  [portal, '/', '307 /minside'],
  [portal, '/?code=x', '307 /auth/callback?code=x'],
  [portal, '/?error_code=otp_expired', '307 /logg-inn?error_code=otp_expired&feil=ugyldig-lenke'],
  [portal, '/logg-inn', null],
  [portal, '/logg-inn?neste=%2Fminside%2Fleider%2Fx', null],
  [portal, '/minside', null],
  [portal, '/minside/leider/x', null],
  [portal, '/admin/bestillinger', null],
  [portal, '/produksjon', null],
  [portal, '/auth/callback?code=x', null],
  [portal, '/auth/confirm?token_hash=x&type=email', null],
  [portal, '/los/abc', null],
  [portal, '/sertifikat/abc', null],
  [portal, '/personvern', null],
  [portal, '/api/vessels?q=test', null],
  [portal, '/api/newsletter/confirm?t=0123456789abcdef0123456789abcdef', null],
  [portal, '/_next/static/chunks/main.js', null],
  [portal, '/_next/image?url=%2Fimages%2Flogo%2FNY-logo.png&w=256&q=75', null],
  [portal, '/images/logo/NY-logo.png', null],
  [portal, '/icons/icon-192.png', null],
  [portal, '/favicon.ico', null],
  [portal, '/icon.png', null],
  [portal, '/apple-icon.png', null],
  [portal, '/manifest.webmanifest', null],
  [portal, '/produkter', `307 ${SITE}/produkter`],
  [portal, '/produkter?x=1', `307 ${SITE}/produkter?x=1`],
  [portal, '/nyheter/en-sak', `307 ${SITE}/nyheter/en-sak`],
  [portal, '/en', `307 ${SITE}/en`],
  [portal, '/en/produkt', `307 ${SITE}/en/produkt`],
  [portal, '/no/produkter', `307 ${SITE}/no/produkter`],
  [portal, '/no/products', `307 ${SITE}/no/products`],
  [portal, '/og/no', `307 ${SITE}/og/no`],
  [portal, '/robots.txt', `307 ${SITE}/robots.txt`],
  [portal, '/sitemap.xml', `307 ${SITE}/sitemap.xml`],
  [portal, '/llms.txt', `307 ${SITE}/llms.txt`],
  // Bare hele første ledd fritar: disse begynner som et portalområde, men er det ikke.
  [portal, '/losning', `307 ${SITE}/losning`],
  [portal, '/administrasjon', `307 ${SITE}/administrasjon`],
  [portal, '/favicon.ico.bak', `307 ${SITE}/favicon.ico.bak`],

  // Andre vertsnavn (forhåndsvisning, localhost) får ingen av vertsreglene.
  [PREVIEW, '/', null],
  [PREVIEW, '/minside', null],
  [PREVIEW, '/logg-inn', null],
  [PREVIEW, '/produkter', null],
  ['localhost:3000', '/minside', null],
  ['localhost:3000', '/produkter', null],
  // Punktumene i vertsnavnet er escapet: dette er et annet domene.
  ['portalxnorthwestcoast.no', '/produkter', null],
  ['northwestcoastxno', '/minside', null],
];

for (const [host, url, answer] of expected) {
  const got = await redirectFor(split, host, url);
  ok(got === answer, `${host}${url} → ${answer ?? 'ingen videresending'} (fikk ${got ?? 'ingen videresending'})`);
}

// Ingen sti sendes fram og tilbake: det portalen sender til nettstedet, sender ikke nettstedet tilbake.
for (const [host, url] of expected) {
  const got = await redirectFor(split, host, url);
  if (host !== portal || !got?.includes(SITE)) continue;
  const back = await redirectFor(split, site, got.slice(got.indexOf(SITE) + SITE.length));
  ok(!back?.includes(PORTAL), `${url} går ikke i ring mellom vertsnavnene`);
}

// Hodene: nøyaktig én CSP per svar, og noindex bare på portalen.
const SITE_CSP = "frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'";
const PORTAL_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SITE} ${SUPABASE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} wss://abc.supabase.co`,
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

for (const [host, csp, robots] of [
  [site, SITE_CSP, undefined],
  [PREVIEW, SITE_CSP, undefined],
  ['localhost:3000', SITE_CSP, undefined],
  [portal, PORTAL_CSP, 'noindex, nofollow'],
] as const) {
  for (const url of ['/', '/logg-inn', '/minside/leider/x', '/api/vessels?q=test', '/_next/static/chunks/main.js', '/produkter']) {
    const headers = await headersFor(split, host, url);
    const csp_ = headers.filter((h) => h.key === 'Content-Security-Policy');
    ok(csp_.length === 1 && csp_[0].value === csp, `riktig CSP, og bare én, på ${host}${url}`);
    ok(headers.find((h) => h.key === 'X-Robots-Tag')?.value === robots, `X-Robots-Tag på ${host}${url}`);
    for (const key of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
      ok(headers.filter((h) => h.key === key).length === 1, `${key} på ${host}${url}`);
    }
  }
}

// ── Adressene fra det gamle nettstedet, i rekkefølgen Vercel bruker ─────────
// Vercels bygger (@vercel/next) tar en 308 som sender hele resten av stien
// videre («/$1») for å være Next sin egen regel for skråstrek til slutt, og
// flytter den foran alle andre regler. Lokalt skjer ikke det. Reglene må gi
// samme svar i begge rekkefølger, ellers ender /no/products på /products.
const movedFirst = (rule: Rule) => rule.permanent === true && /^\/:\w+[*+?]?\/?$/.test(rule.destination ?? '');
const onVercel: Config = {
  ...split,
  redirects: async () => {
    const rules = await split.redirects();
    return [...rules.filter(movedFirst), ...rules.filter((rule) => !movedFirst(rule))];
  },
};
ok(!(await split.redirects()).some(movedFirst), 'ingen regel er en 308 som Vercel flytter foran de andre');
for (const [url, answer] of [
  ['/no', '308 /'],
  ['/no/about-us', '308 /om-oss'],
  ['/no/products', '308 /produkter'],
  ['/no/news', '308 /nyheter'],
  ['/no/contact-us', '308 /#kontakt'],
  ['/no/login', '308 /logg-inn'],
  ['/no/register', '308 /logg-inn'],
  ['/no/my-site', '308 /minside'],
  ['/no/leveranse-ms-skar-senior', '308 /nyheter'],
  ['/en/about-us', '308 /en/om-oss'],
  ['/en/products', '308 /en/produkter'],
  ['/en/contact-us', '308 /en#kontakt'],
  ['/no/faq', '301 /faq'],
  ['/no/produkt/los', '301 /produkt/los'],
] as const) {
  for (const [config, order] of [[split, 'lokalt'], [onVercel, 'på Vercel']] as const) {
    const got = await redirectFor(config, site, url);
    ok(got === answer, `${url} → ${answer} ${order} (fikk ${got ?? 'ingen videresending'})`);
  }
}

// I utvikling trenger Next eval og en websocket til seg selv.
setEnv({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'http://localhost:3200', NEXT_PUBLIC_PORTAL_URL: 'http://portal.localhost:3200', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54400' });
const devCsp = (await headersFor(split, 'portal.localhost:3200', '/logg-inn')).find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
ok(devCsp.includes("script-src 'self' 'unsafe-inline' 'unsafe-eval';"), 'eval er tillatt i utvikling');
ok(devCsp.includes("connect-src 'self' http://localhost:54400 ws://localhost:54400 ws://portal.localhost:3200;"), 'websocket til seg selv i utvikling');
ok(await redirectFor(split, 'localhost:3200', '/minside/x?a=1') === '307 http://portal.localhost:3200/minside/x?a=1', 'porten følger med til portalen');
ok(await redirectFor(split, 'portal.localhost:3200', '/produkter') === '307 http://localhost:3200/produkter', 'porten følger med til nettstedet');

// Uten Supabase konfigurert står ingenting «undefined» i regelen.
setEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: undefined });
const bareCsp = (await headersFor(split, 'portal.localhost:3200', '/')).find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
ok(bareCsp.includes("connect-src 'self';") && !/undefined|null|false/.test(bareCsp), 'CSP uten Supabase er ren');

// ── Lenkene i lib/site.ts ───────────────────────────────────────────────────
// Modulen leser miljøet når den lastes, så hver variant lastes for seg.
type Site = typeof import('../lib/site.ts');
let variant = 0;
async function loadSite(env: Record<string, string | undefined>): Promise<Site> {
  setEnv({ VERCEL_ENV: undefined, VERCEL_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined, ...env });
  variant += 1;
  return import(`../lib/site.ts?variant=${variant}`);
}

const one = await loadSite({ NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_PORTAL_URL: undefined });
ok(!one.PORTAL_HAS_OWN_HOST && one.PORTAL_URL === one.SITE_URL, 'uten variablene ligger portalen på nettstedets adresse');
ok(one.portalHref('/logg-inn') === '/logg-inn' && one.siteHref('/produkter') === '/produkter', 'relative lenker uten eget vertsnavn');

const same = await loadSite({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_PORTAL_URL: `${SITE}/` });
ok(!same.PORTAL_HAS_OWN_HOST && same.portalHref('/logg-inn') === '/logg-inn', 'samme vertsnavn regnes som én adresse');

// Bare portalen satt: reglene i next.config.mjs er av, og da skal lenkene også være relative.
const half = await loadSite({ NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_PORTAL_URL: PORTAL });
ok(!half.PORTAL_HAS_OWN_HOST && half.portalHref('/logg-inn') === '/logg-inn' && half.siteHref('/') === '/', 'begge adressene må være satt');

const two = await loadSite({ NEXT_PUBLIC_SITE_URL: `${SITE}/`, NEXT_PUBLIC_PORTAL_URL: `${PORTAL}/` });
ok(two.PORTAL_HAS_OWN_HOST && two.SITE_URL === SITE && two.PORTAL_URL === PORTAL, 'eget vertsnavn, uten skråstrek til slutt');
ok(two.portalHref('/logg-inn') === `${PORTAL}/logg-inn`, 'lenker inn i portalen får portalens adresse');
ok(two.siteHref('/') === `${SITE}/` && two.siteHref('/en/produkt') === `${SITE}/en/produkt`, 'lenker ut av portalen får nettstedets adresse');

for (const path of ['/logg-inn', '/minside', '/minside/leider/x', '/admin', '/produksjon/ny', '/auth/confirm', '/los/abc', '/sertifikat/abc', '/personvern']) {
  ok(two.isPortalPage(path), `${path} ligger i portaldelen`);
}
for (const path of ['/', '/produkter', '/en', '/losning', '/administrasjon', '/nyheter/minside']) {
  ok(!two.isPortalPage(path), `${path} er en offentlig side`);
}

if (failed) { console.error(`${failed} test(er) feilet.`); process.exit(1); }
console.log('Vertsreglene for portalen består.');
