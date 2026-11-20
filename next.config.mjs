/**
 * Det lokale testmiljøet (supabase/local) serverer lagringen over http på
 * localhost. next/image får bare hente derfra utenfor produksjon, og bare når
 * Supabase-adressen faktisk peker dit.
 */
function localStoragePatterns() {
  if (process.env.NODE_ENV === 'production') return [];
  const match = /^http:\/\/(localhost|127\.0\.0\.1):(\d+)$/.exec(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
  if (!match) return [];
  return [{ protocol: 'http', hostname: match[1], port: match[2], pathname: '/storage/v1/object/public/**' }];
}

/** @type {import('next').NextConfig} */
/**
 * Bildene som lastes opp i admin ligger i den offentlige bøtta i prosjektets
 * egen Supabase Storage. Bare akkurat den verten og den bøtta slippes gjennom
 * next/image, ellers kunne hvem som helst brukt bildeoptimaliseringen vår på
 * bilder fra sitt eget Supabase-prosjekt.
 */
function mediaPatterns() {
  try {
    const { protocol, hostname } = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (protocol !== 'https:') return [];
    return [{ protocol: 'https', hostname, pathname: '/storage/v1/object/public/public-media/**' }];
  } catch {
    return [];
  }
}

/**
 * Første ledd i stiene til den innloggede delen (app/(portal) og app/auth).
 * Lista brukes tre steder her: den holder områdene utenfor språkskallet i
 * rewrites(), den avgjør hva nettstedets vertsnavn sender videre til
 * portalen, og hva portalens vertsnavn svarer på selv. PORTAL_PAGE i
 * lib/site.ts har de samme områdene.
 */
const PORTAL_AREAS = ['minside', 'admin', 'produksjon', 'logg-inn', 'auth', 'los', 'sertifikat'];

/**
 * Portalen på eget vertsnavn (NEXT_PUBLIC_PORTAL_URL, f.eks.
 * https://portal.northwestcoast.no), ved siden av nettstedet
 * (NEXT_PUBLIC_SITE_URL).
 *
 * Gir null når en av variablene mangler eller vertsnavnene er like. Da
 * ligger alt på én adresse, som i lokal utvikling, i forhåndsvisninger og
 * på vercel.app, og ingen av vertsreglene under finnes.
 *
 * Reglene står i redirects() og headers() med `has: host`, ikke i
 * middleware: de offentlige sidene er statiske, og hver middleware-kjøring
 * faktureres. `has: host` sammenligner vertsnavnet uten port, og leser
 * verdien som et regulært uttrykk. Derfor escapes punktumene.
 */
function portalHosts() {
  const parse = (value) => {
    try {
      return new URL(value ?? '');
    } catch {
      return null;
    }
  };
  const site = parse(process.env.NEXT_PUBLIC_SITE_URL);
  const portal = parse(process.env.NEXT_PUBLIC_PORTAL_URL);
  if (!site || !portal || site.hostname === portal.hostname) return null;

  const pattern = (url) => url.hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    site: site.origin,
    portal: portal.origin,
    onSite: [{ type: 'host', value: pattern(site) }],
    onPortal: [{ type: 'host', value: pattern(portal) }],
  };
}

/**
 * Videresendingene mellom de to vertsnavnene. De står FØRST i redirects(),
 * for der vinner den første regelen som treffer:
 *
 * - På portalens vertsnavn skal disse avgjøre før de gamle adressene og
 *   /no-reglene. /no/products går dermed først til nettstedet, og får sin
 *   endelige adresse der.
 * - Unntaket er «/» med ?code eller ?error_code, altså en innloggingslenke
 *   som har landet på forsiden. Regelen for «/» på portalen slipper dem
 *   forbi med `missing`, så de når /auth/callback-reglene lenger ned og
 *   blir værende på portalen.
 * - På nettstedets vertsnavn treffer bare portalstiene, og ingen av de
 *   eksisterende reglene har en slik kilde. På andre vertsnavn
 *   (forhåndsvisninger, localhost) treffer ingen av reglene.
 *
 * Alle er midlertidige (307): hvor portalen ligger er oppsett, ikke noe
 * nettlesere skal huske. Spørringen (?neste=, ?code=) følger med av seg selv.
 */
function hostRedirects(hosts) {
  if (!hosts) return [];

  // Det portalens vertsnavn svarer på selv: portalområdene, personvern,
  // API-et, Next sine egne filer, og bildene og ikonene portalsidene bruker.
  const served = [
    ...PORTAL_AREAS, 'personvern', 'api', '_next', 'images', 'icons',
    'favicon\\.ico', 'icon\\.png', 'apple-icon\\.png', 'manifest\\.webmanifest',
  ].join('|');

  return [
    {
      source: `/:area(${PORTAL_AREAS.join('|')})/:path*`,
      has: hosts.onSite,
      destination: `${hosts.portal}/:area/:path*`,
      permanent: false,
    },
    {
      source: '/',
      has: hosts.onPortal,
      missing: [{ type: 'query', key: 'code' }, { type: 'query', key: 'error_code' }],
      destination: '/minside',
      permanent: false,
    },
    {
      // Alt annet hører til nettstedet. Forbudet gjelder hele første ledd
      // («/los/x» blir, «/losning» går), derfor (?:/|$) etter navnene.
      source: `/:first((?!(?:${served})(?:/|$))[^/]+)/:path*`,
      has: hosts.onPortal,
      destination: `${hosts.site}/:first/:path*`,
      permanent: false,
    },
  ];
}

/**
 * Innholdsregelen (CSP) for portalens vertsnavn. Nettstedets regel er løs
 * fordi de offentlige sidene henter analyse og video utenfra. Portalen
 * henter alt fra seg selv, og slipper ellers bare til:
 *
 * - Supabase: innlogging og opplasting går rett fra nettleseren, og private
 *   bilder vises med signerte adresser derfra.
 * - Nettstedets adresse, bare for bilder: forhåndsvisningen av e-postene i
 *   admin viser logoen slik mottakerne får den, og den ligger på nettstedet.
 *
 * 'unsafe-inline' må med for skript og stiler: Next skriver sidens data inn
 * som innebygde skript, og komponentene bruker style-attributter. I utvikling
 * trenger Next i tillegg eval og en websocket for oppdatering uten omlasting.
 */
function portalCsp(hosts) {
  let supabase = [];
  try {
    const { origin } = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    supabase = [origin, origin.replace(/^http/, 'ws')];
  } catch {
    // Uten Supabase konfigurert er det ingenting utenfra å slippe til.
  }
  const dev = process.env.NODE_ENV !== 'production';
  const list = (...sources) => sources.filter(Boolean).join(' ');

  return [
    "default-src 'self'",
    list("script-src 'self' 'unsafe-inline'", dev && "'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'",
    list("img-src 'self' data: blob:", hosts.site, supabase[0]),
    "font-src 'self' data:",
    list("connect-src 'self'", ...supabase, dev && hosts.portal.replace(/^http/, 'ws')),
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const nextConfig = {
  poweredByHeader: false,

  // En ekstra utviklingsserver (f.eks. mot det lokale testmiljøet på en annen
  // port) må ha sin egen byggemappe, ellers skriver de to over hverandre.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // CSS caching fix
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // @react-pdf/renderer drar med seg avhengigheter som ikke tåler å bli
  // bundlet av webpack. Lar Node laste pakken direkte i stedet.
  serverExternalPackages: ['@react-pdf/renderer'],

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Forsidebilder til nyheter og bildene i galleriet lastes opp i admin og
    // ligger i den offentlige bøtta i Supabase Storage. Bare den stien slippes
    // gjennom next/image.
    remotePatterns: [...mediaPatterns(), ...localStoragePatterns()],
  },

  // Gamle URL-er fra dagens live-nettsted, slik at lenker og søkerangering
  // følger med ved overgangen. Nye norske sider ligger på rot, engelske under /en.
  async redirects() {
    // [gammel sti, ny sti på norsk, ny sti på engelsk]
    const map = [
      ['news', '/nyheter', '/en/nyheter'],
      ['products', '/produkter', '/en/produkter'],
      // Kontakt var egen side; skjemaet ligger nå nederst på forsiden.
      ['contact-us', '/#kontakt', '/en#kontakt'],
      ['about-us', '/om-oss', '/en/om-oss'],
      // Innlogging finnes fortsatt, nå som innloggingslenke på e-post.
      ['login', '/logg-inn', '/logg-inn'],
      ['register', '/logg-inn', '/logg-inn'],
      ['my-site', '/minside', '/minside'],
      ['leveranse-ms-skar-senior', '/nyheter', '/en/nyheter'],
      ['hvordan-bruke-var-leider', '/nyheter', '/en/nyheter'],
      ['hvordan-installere-var-leider', '/nyheter', '/en/nyheter'],
    ];
    // Vertsreglene må stå først, se hostRedirects().
    const rules = hostRedirects(portalHosts());
    for (const [from, no, en] of map) {
      rules.push({ source: `/no/${from}`, destination: no, permanent: true });
      rules.push({ source: `/en/${from}`, destination: en, permanent: true });
    }
    // Innloggingslenke som lander på forsiden. Det skjer når adressen appen ba
    // om ikke er godkjent i Supabase (Authentication → URL Configuration): da
    // sender Supabase brukeren til Site URL med koden hengende på. Uten disse
    // reglene vises bare forsiden, og ingen blir logget inn.
    rules.push({
      source: '/',
      has: [{ type: 'query', key: 'code' }],
      destination: '/auth/callback',
      permanent: false,
    });
    rules.push({
      source: '/',
      has: [{ type: 'query', key: 'error_code' }],
      destination: '/logg-inn?feil=ugyldig-lenke',
      permanent: false,
    });
    // Én kanonisk adresse per side: norsk ligger på rot, ikke under /no.
    rules.push({ source: '/no', destination: '/', permanent: true });
    // 301 og ikke 308 med vilje. Vercels bygger tar en 308 som sender hele
    // resten av stien videre («/$1») for å være Next sin egen regel for
    // skråstrek til slutt, og flytter den foran alle andre regler. Da traff
    // /no/products denne først og endte på /products, som ikke finnes.
    rules.push({ source: '/no/:path*', destination: '/:path*', statusCode: 301 });
    return rules;
  },

  // Norsk er standardspråk og ligger på rot (/produkt), selv om filene ligger
  // under app/(site)/[lang]. Rewrites fungerer uten middleware, så sidene kan
  // fortsatt genereres statisk. afterFiles: public-filer og rutehandlere
  // (sitemap, robots, llms.txt, /api, /og) vinner før språkreglene kjører.
  async rewrites() {
    // Innloggede områder og tekniske stier hører ikke til språkskallet.
    const skip = ['no', 'en', 'api', 'og', ...PORTAL_AREAS, 'personvern', '_next'].join('|');
    return {
      beforeFiles: [],
      afterFiles: [
        { source: '/', destination: '/no' },
        { source: `/:path((?!${skip})[^/]+)`, destination: '/no/:path' },
        { source: `/:path((?!${skip})[^/]+)/:rest*`, destination: '/no/:path/:rest*' },
      ],
      fallback: [],
    };
  },

  async headers() {
    // Siden kan ikke legges i en ramme på andre nettsteder, skjemaer
    // kan bare sende til oss selv, og <base> og <object> kan ikke
    // brukes til å lede sidens egne lenker og skript et annet sted.
    const siteCsp = {
      key: 'Content-Security-Policy',
      value: "frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'",
    };
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    const hosts = portalHosts();
    if (!hosts) return [{ source: '/(.*)', headers: [siteCsp, ...common] }];

    // Portalen på eget vertsnavn: der skal ingenting i søk, og innholdsregelen
    // er strengere. De to CSP-reglene utelukker hverandre med has/missing på
    // vertsnavnet, så et svar aldri får to regler som må tolkes sammen
    // (nettleseren ville håndhevet begge), uansett rekkefølgen på reglene.
    return [
      { source: '/(.*)', headers: common },
      { source: '/(.*)', missing: hosts.onPortal, headers: [siteCsp] },
      {
        source: '/(.*)',
        has: hosts.onPortal,
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Content-Security-Policy', value: portalCsp(hosts) },
        ],
      },
    ];
  },
};

export default nextConfig;
