import { Fragment, type ReactNode } from 'react';
import PostSlideshow from '@/components/post-slideshow';
import { canOptimizeImage } from '@/lib/articles';
import type { Lang } from '@/lib/i18n';
import { parseBody, resolveImage } from '@/lib/post-markdown';

/**
 * Tegner brødteksten i et innlegg.
 *
 * Formatet er beskrevet i lib/post-markdown.ts: avsnitt, «## » mellomtittel,
 * «- » punkt, **fet**, [lenke](https://…) og bildeblokker («:::bilder»), som
 * vises som lysbildeshow.
 *
 * Alt bygges som React-elementer. Ingenting i teksten tolkes som HTML, så
 * det som skrives i admin kan aldri bli til skript på nettsiden.
 */

/** Bare http(s)-adresser blir lenker. javascript:, data: og relative stier blir det ikke. */
function safeUrl(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

const LINK_STYLE = { textDecoration: 'underline', textUnderlineOffset: '3px', fontWeight: 600 } as const;

/** **fet** og [lenker] i én linje. Det som ikke er gyldig, står igjen som tekst. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let count = 0;

  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const key = `${keyPrefix}.${count++}`;

    if (match[1] !== undefined) {
      nodes.push(<strong key={key}>{inline(match[1], key)}</strong>);
    } else {
      const href = safeUrl(match[3]);
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
            {inline(match[2], key)}
          </a>
        ) : (
          match[0]
        ),
      );
    }
    last = start + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function PostBody({ body, lang = 'no' }: { body: string; lang?: Lang }) {
  return (
    <>
      {parseBody(body).map((block, index) => {
        const key = String(index);

        if (block.kind === 'gallery') {
          // Bilder vi ikke godtar (feil adresse, filnavn som aldri ble lastet opp) hoppes over.
          const images = block.images.flatMap(({ ref, caption }) => {
            const src = resolveImage(ref);
            return src ? [{ src, caption, unoptimized: !canOptimizeImage(src) }] : [];
          });
          return images.length ? <PostSlideshow key={key} images={images} lang={lang} /> : null;
        }

        if (block.kind === 'heading') {
          return <h2 key={key}>{inline(block.text, key)}</h2>;
        }

        if (block.kind === 'list') {
          return (
            // Nullstillingen i globals.css fjerner punktene; her skal de vises.
            <ul key={key} style={{ listStyle: 'disc' }}>
              {block.items.map((item, i) => (
                <li key={i}>{inline(item, `${key}.${i}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={key}>
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(line, `${key}.${i}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
