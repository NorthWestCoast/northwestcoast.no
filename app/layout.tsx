import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';

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
  title: 'NorthWest Coast – Argostep Maritime Ladder',
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
  openGraph: {
    title: 'NorthWest Coast – Argostep Maritime Ladder',
    description: 'Modulær maritim leider. ISO 799-1:2019 sertifisert. Norsk produksjon.',
    locale: 'nb_NO',
    type: 'website',
  },
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
      <body>{children}</body>
    </html>
  );
}
