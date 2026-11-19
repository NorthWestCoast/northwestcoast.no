/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // Forsidebilder til nyheter lastes opp i admin og ligger i den offentlige
    // bøtta i Supabase Storage. Bare den stien slippes gjennom next/image.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
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
      ['leveranse-ms-skar-senior', '/nyheter', '/en/nyheter'],
      ['hvordan-bruke-var-leider', '/nyheter', '/en/nyheter'],
      ['hvordan-installere-var-leider', '/nyheter', '/en/nyheter'],
    ];
    const rules = [];
    for (const [from, no, en] of map) {
      rules.push({ source: `/no/${from}`, destination: no, permanent: true });
      rules.push({ source: `/en/${from}`, destination: en, permanent: true });
    }
    // Én kanonisk adresse per side: norsk ligger på rot, ikke under /no.
    rules.push({ source: '/no', destination: '/', permanent: true });
    rules.push({ source: '/no/:path*', destination: '/:path*', permanent: true });
    return rules;
  },

  // Norsk er standardspråk og ligger på rot (/produkt), selv om filene ligger
  // under app/(site)/[lang]. Rewrites fungerer uten middleware, så sidene kan
  // fortsatt genereres statisk. afterFiles: public-filer og rutehandlere
  // (sitemap, robots, llms.txt, /api, /og) vinner før språkreglene kjører.
  async rewrites() {
    // Innloggede områder og tekniske stier hører ikke til språkskallet.
    const skip = 'no|en|api|og|minside|admin|produksjon|logg-inn|auth|los|personvern|_next';
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
    return [
      {
        source: '/(.*)',
        headers: [
          // Replaced X-Frame-Options: DENY with a CSP frame-ancestors directive
          // so Vercel previews and v0.dev can embed the page while still
          // blocking arbitrary third-party framing in modern browsers.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://v0.dev https://*.vercel.app https://*.vercel-preview.com",
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
