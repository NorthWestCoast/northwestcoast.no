import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import Analytics from '@/components/analytics';
import JsonLd from '@/components/json-ld';
import { LangProvider } from '@/components/lang-provider';
import { organizationLd, websiteLd } from '@/lib/seo';
import { LANGS, buildAlternates, getDict, isLang, SITE_URL } from '@/lib/i18n';
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const dict = getDict(lang);

  return {
    metadataBase: new URL(SITE_URL),
    title: dict.meta.home.title,
    description: dict.meta.home.description,
    applicationName: 'NorthWest Coast',
    keywords: dict.meta.keywords,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
    },
    twitter: { card: 'summary_large_image', images: [`${SITE_URL}/og/${lang}`], title: dict.meta.home.title, description: dict.meta.home.ogDescription },
    alternates: buildAlternates('/'),
    openGraph: {
      images: [{ url: `${SITE_URL}/og/${lang}`, width: 1200, height: 630 }],
      title: dict.meta.home.title,
      description: dict.meta.home.ogDescription,
      locale: dict.ogLocale,
      type: 'website',
    },
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
        <JsonLd data={[organizationLd(), websiteLd(lang)]} />
        <LangProvider lang={lang}>{children}</LangProvider>
        <Analytics />
      </body>
    </html>
  );
}
