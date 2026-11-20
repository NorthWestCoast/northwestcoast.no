import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import Analytics from '@/components/analytics';
import JsonLd from '@/components/json-ld';
import { LangProvider } from '@/components/lang-provider';
import { organizationLd, websiteLd } from '@/lib/seo';
import { LANGS, getDict, isLang, pageMetadata, SITE_NAME } from '@/lib/i18n';
import { THEME_COLOR } from '@/lib/site';
import '../../globals.css'; // Global styles

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

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

// Fargen på adresselinja i mobilnettlesere: samme marineblå som toppen av siden.
export const viewport: Viewport = { themeColor: THEME_COLOR };

/**
 * Metadata for forsiden, og standardverdier for sidene under. Favikon,
 * apple-touch-icon og manifest kommer fra filene i app/ (favicon.ico,
 * icon.png, apple-icon.png, manifest.ts) og trenger ikke nevnes her.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = getDict(lang);
  const home = pageMetadata(lang, 'home', '/');

  return {
    ...home,
    applicationName: SITE_NAME,
    keywords: dict.meta.keywords,
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
    },
    // Bare korttypen: tittel, beskrivelse og bilde fylles fra hver sides openGraph.
    twitter: { card: 'summary_large_image' },
    openGraph: { ...home.openGraph, description: dict.meta.home.ogDescription },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  return (
    <html
      lang={getDict(lang).htmlLang}
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>
        <JsonLd data={[organizationLd(lang), websiteLd(lang)]} />
        <LangProvider lang={lang}>{children}</LangProvider>
        <Analytics />
      </body>
    </html>
  );
}
