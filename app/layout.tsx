import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css'; // Global styles
import Analytics from '@/components/analytics';
import { SITE_URL } from '@/lib/site';

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
  // metadataBase gjør at OG-bilder og kanoniske URL-er blir absolutte.
  // Uten den blir delte lenker på LinkedIn/Facebook/WhatsApp uten bilde.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'NorthWest Coast – Argostep Maritime Ladder',
    template: '%s | NorthWest Coast',
  },
  description:
    'Argostep – den lette, modulære maritime leideren godkjent av Sjøfartsdirektoratet. ISO 799-1:2019 sertifisert. Norsk produksjon fra Sunnmøre.',
  keywords: [
    'maritim leider',
    'Argostep',
    'NorthWest Coast',
    'sjøleider',
    'Sjøfartsdirektoratet',
    'ISO 799',
    'fiskebåt',
    'ombordstigning',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'NorthWest Coast – Argostep Maritime Ladder',
    description: 'Modulær maritim leider. ISO 799-1:2019 sertifisert. Norsk produksjon.',
    url: '/',
    siteName: 'NorthWest Coast',
    locale: 'nb_NO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NorthWest Coast – Argostep Maritime Ladder',
    description: 'Modulær maritim leider. ISO 799-1:2019 sertifisert. Norsk produksjon.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="no"
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
