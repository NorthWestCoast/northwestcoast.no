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
  },

  // Gamle URL-er fra dagens live-nettsted, slik at lenker og søkerangering
  // følger med ved overgangen.
  async redirects() {
    // [gammel sti, ny sti]. Engelske sider finnes ikke ennå, så /en/* på det
    // gamle nettstedet lander på de norske sidene. Når /en er bygget, pek
    // /en/<sti> til /en/<ny sti> i stedet.
    const map = [
      ['news', '/nyheter'],
      ['products', '/produkt'],
      // Kontakt var egen side; skjemaet ligger nå nederst på forsiden.
      ['contact-us', '/#kontakt'],
      ['about-us', '/'],
      // Innlogging finnes fortsatt, nå som innloggingslenke på e-post.
      ['login', '/logg-inn'],
      ['register', '/logg-inn'],
      ['faq', '/faq'],
      ['leveranse-ms-skar-senior', '/nyheter'],
      ['hvordan-bruke-var-leider', '/nyheter'],
      ['hvordan-installere-var-leider', '/nyheter'],
    ];
    const rules = [
      { source: '/no', destination: '/', permanent: true },
      { source: '/en', destination: '/', permanent: true },
    ];
    for (const [from, to] of map) {
      rules.push({ source: `/no/${from}`, destination: to, permanent: true });
      rules.push({ source: `/en/${from}`, destination: to, permanent: true });
    }
    return rules;
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
