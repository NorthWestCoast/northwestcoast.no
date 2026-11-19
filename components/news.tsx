import NewsCard, { type FeaturedArticle } from '@/components/news-card';
import { LANGS, type Lang } from '@/lib/i18n';
import { getArticles } from '@/lib/posts';

/**
 * Nyhetsseksjonen på forsiden.
 *
 * Serverkomponent: henter det nyeste innlegget fra lib/posts.ts (databasen,
 * mellomlagret med POSTS_TAG) på begge språk, og lar klientdelen vise det som
 * passer språket siden står på. Innleggene leses én gang; språkene er bare to
 * visninger av de samme radene.
 */
export default async function News() {
  const entries = await Promise.all(
    LANGS.map(async (lang): Promise<[Lang, FeaturedArticle | null]> => {
      const [latest] = await getArticles(lang);
      if (!latest) return [lang, null];
      const { slug, date, image, tag, title, teaser } = latest;
      return [lang, { slug, date, image, tag, title, teaser }];
    }),
  );

  return <NewsCard featured={Object.fromEntries(entries) as Record<Lang, FeaturedArticle | null>} />;
}
