import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import '../globals.css'; // Global styles
import './portal.css';
import { no } from '@/lib/dictionaries/no';
import { SITE_URL, THEME_COLOR } from '@/lib/site';

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

// Fargen på adresselinja i mobilnettlesere, lik den offentlige delen.
export const viewport: Viewport = { themeColor: THEME_COLOR };

/**
 * Standardverdier for sidene i denne delen: innlogging, personvern og de
 * innloggede områdene (som selv setter noindex). Favikon, apple-touch-icon og
 * manifest kommer fra filene i app/ og gjelder begge rot-layoutene.
 *
 * Ingen canonical her: en standard-canonical til «/» ville blitt arvet av
 * sider som ikke setter sin egen, og pekt dem til forsiden.
 */
export const metadata: Metadata = {
  // metadataBase gjør at OG-bilder og kanoniske URL-er blir absolutte.
  // Uten den blir delte lenker på LinkedIn/Facebook/WhatsApp uten bilde.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'NorthWest Coast – Argostep leider til båt',
    template: '%s | NorthWest Coast',
  },
  description: no.meta.home.description,
  applicationName: 'NorthWest Coast',
  openGraph: {
    title: 'NorthWest Coast – Argostep leider til båt',
    description: no.meta.home.ogDescription,
    siteName: 'NorthWest Coast',
    locale: 'nb_NO',
    type: 'website',
    images: [{ url: '/og/no', width: 1200, height: 630 }],
  },
  // Bare korttypen: tittel, beskrivelse og bilde fylles fra openGraph.
  twitter: { card: 'summary_large_image' },
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
        {/* Ingen besøksanalyse her. Adressene i denne delen kan inneholde
            engangsnøkler (innloggingslenke, delt rapport, sertifikat), og de
            skal ikke sendes til en tredjepart. Analysen står bare i den
            offentlige delen, se app/(site)/[lang]/layout.tsx. */}
        {children}
      </body>
    </html>
  );
}
