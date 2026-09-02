import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css'; // Global styles
import JsonLd from '@/components/json-ld';
import { SITE, SITE_URL, abs } from '@/lib/site';
import { graph, organizationNode, websiteNode } from '@/lib/structured-data';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  // metadataBase turns every relative URL below (and in child pages) into an
  // absolute one. Without it Next emits relative og:image/canonical values,
  // which social and AI crawlers silently drop.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Argostep maritim leider – lett, modulær og sertifisert | NorthWest Coast',
    // Child pages set only their own title; the brand suffix is appended here
    // so no page has to repeat it and no title ends up double-branded.
    template: '%s | NorthWest Coast',
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.legalName, url: SITE_URL }],
  creator: SITE.legalName,
  publisher: SITE.legalName,
  category: 'Maritimt sikkerhetsutstyr',
  keywords: [
    'maritim leider',
    'Argostep',
    'NorthWest Coast',
    'livbåtleider',
    'losleider',
    'entringsleider',
    'sjøleider',
    'leider fiskebåt',
    'Sjøfartsdirektoratet',
    'ISO 799-1:2019',
    'ombordstigning',
    'leiderkalkulator',
  ],
  // Note: every page overrides `alternates` with its own canonical, which in
  // Next replaces the whole object. The llms.txt <link rel="alternate"> is
  // therefore emitted from <head> below instead, so it appears on all pages.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: SITE.locale,
    url: '/',
    title: 'Argostep maritim leider – lett, modulær og sertifisert',
    description: SITE.description,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: 'Argostep maritim leider' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Argostep maritim leider – lett, modulær og sertifisert',
    description: SITE.description,
    images: [SITE.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Uncapped snippets and previews: answer engines and rich results can
      // only quote as much of the page as these directives allow.
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  formatDetection: { telephone: true, address: true, email: true },
  other: {
    'geo.region': 'NO-15',
    'geo.placename': SITE.address.city,
    'geo.position': `${SITE.geo.lat};${SITE.geo.lng}`,
  },
};

export const viewport: Viewport = {
  themeColor: '#0a1628',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      // "nb" (bokmål) rather than the generic "no": more precise for both
      // hreflang-style signals and for LLMs deciding which language to answer in.
      lang={SITE.lang}
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <head>
        {/* The 3D viewer and its model are third-party/large; warming the
            connection early removes a round trip from that request chain. */}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
        <link rel="alternate" type="text/plain" href={abs('/llms.txt')} title="llms.txt" />
      </head>
      <body>
        {/* Site-wide entities: emitted once, referenced by @id from every page. */}
        <JsonLd data={graph([organizationNode(), websiteNode()])} />
        {children}
      </body>
    </html>
  );
}
