/** @type {import('next').NextConfig} */
const nextConfig = {
  // CSS caching fix
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Gamle URL-er fra dagens live-nettsted, slik at lenker og søkerangering
  // følger med ved overgangen. Nye norske sider ligger på rot, engelske under /en.
  async redirects() {
    // [gammel sti, ny sti på norsk, ny sti på engelsk]
    const map = [
      ['news', '/nyheter', '/en/nyheter'],
      ['products', '/produkt', '/en/produkt'],
      // Kontakt var egen side; skjemaet ligger nå nederst på forsiden.
      ['contact-us', '/#kontakt', '/en#kontakt'],
      ['about-us', '/', '/en'],
      ['login', '/', '/en'],
      ['register', '/', '/en'],
      ['leveranse-ms-skar-senior', '/nyheter', '/en/nyheter'],
      ['hvordan-bruke-var-leider', '/nyheter', '/en/nyheter'],
      ['hvordan-installere-var-leider', '/nyheter', '/en/nyheter'],
    ];
    const rules = [];
    for (const [from, no, en] of map) {
      rules.push({ source: `/no/${from}`, destination: no, permanent: true });
      rules.push({ source: `/en/${from}`, destination: en, permanent: true });
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
