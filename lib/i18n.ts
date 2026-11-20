import { SITE_URL } from './site';
import { no, type Dict } from './dictionaries/no';
import { en } from './dictionaries/en';

export const LANGS = ['no', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Norsk ligger på rot (/produkt), engelsk under /en (/en/produkt). */
export const DEFAULT_LANG: Lang = 'no';

export { SITE_URL };

const DICTS: Record<Lang, Dict> = { no, en };

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

export function getDict(lang: Lang): Dict {
  return DICTS[lang] ?? DICTS[DEFAULT_LANG];
}

/** Fjerner et eventuelt språkprefiks: '/en/produkt' → '/produkt'. */
export function stripLangPrefix(pathname: string): string {
  for (const lang of LANGS) {
    if (pathname === `/${lang}`) return '/';
    if (pathname.startsWith(`/${lang}/`)) return pathname.slice(lang.length + 1);
  }
  return pathname || '/';
}

/** Bygger URL-en for en sti i et gitt språk. */
export function localePath(lang: Lang, pathname: string): string {
  const path = stripLangPrefix(pathname);
  if (lang === DEFAULT_LANG) return path;
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

export function langFromPath(pathname: string): Lang {
  for (const lang of LANGS) {
    if (pathname === `/${lang}` || pathname.startsWith(`/${lang}/`)) return lang;
  }
  return DEFAULT_LANG;
}

export type MetaKey = keyof Dict['meta'] extends infer K
  ? K extends 'keywords'
    ? never
    : K
  : never;

/**
 * Felles metadata med canonical + hreflang, slik at Google skjønner at
 * /produkt og /en/produkt er samme side på to språk.
 */
export function buildAlternates(pathname: string) {
  const path = stripLangPrefix(pathname);
  return {
    canonical: `${SITE_URL}${localePath(DEFAULT_LANG, path)}`,
    languages: {
      'nb-NO': `${SITE_URL}${localePath('no', path)}`,
      en: `${SITE_URL}${localePath('en', path)}`,
      'x-default': `${SITE_URL}${localePath(DEFAULT_LANG, path)}`,
    },
  };
}

/** Navnet nettstedet går under i delingskort og strukturerte data. */
export const SITE_NAME = 'NorthWest Coast';

/** Delingsbildet (1200×630) som app/og/[lang]/route.tsx tegner. */
export function ogImage(lang: Lang) {
  return {
    url: `${SITE_URL}/og/${lang}`,
    width: 1200,
    height: 630,
    alt: `${SITE_NAME} – Argostep. ${getDict(lang).meta.home.ogDescription}`,
  };
}

/**
 * Metadata for én side: unik tittel og beskrivelse, canonical til sidens egen
 * adresse på eget språk, hreflang til begge språk, og delingskort.
 *
 * Twitter-kortet settes ikke her: rot-layouten oppgir bare korttypen, og Next
 * fyller da tittel, beskrivelse og bilde fra openGraph for hver side. Sto de i
 * layouten, ville alle undersider arvet forsidens tittel i kortet.
 */
export function pageMetadata(lang: Lang, key: MetaKey, pathname: string) {
  const dict = getDict(lang);
  const meta = dict.meta[key];
  const url = `${SITE_URL}${localePath(lang, pathname)}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    alternates: {
      ...buildAlternates(pathname),
      canonical: url,
    },
    openGraph: {
      siteName: SITE_NAME,
      images: [ogImage(lang)],
      title: meta.title,
      description: meta.description,
      locale: dict.ogLocale,
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => getDict(l).ogLocale),
      type: 'website' as const,
      url,
    },
  };
}
