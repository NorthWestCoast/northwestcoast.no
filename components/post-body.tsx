import { Fragment, type ReactNode } from 'react';

/**
 * Tegner brødteksten i et innlegg.
 *
 * Teksten er ren tekst med et lite markdown-utvalg, slik den skrives i admin:
 *
 *   blank linje          nytt avsnitt
 *   ## Tittel            mellomtittel
 *   - punkt              punktliste
 *   **fet**              utheving
 *   [tekst](https://…)   lenke (bare http og https)
 *
 * Alt bygges som React-elementer. Ingenting i teksten tolkes som HTML, så
 * det som skrives i admin kan aldri bli til skript på nettsiden.
 */

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; items: string[] };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  // Avsnittet eller lista som fortsatt tar imot linjer.
  let open: Extract<Block, { kind: 'paragraph' | 'list' }> | null = null;

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();

    if (!line) {
      open = null;
    } else if (line.startsWith('## ')) {
      open = null;
      blocks.push({ kind: 'heading', text: line.slice(3).trim() });
    } else if (line.startsWith('- ')) {
      if (open?.kind !== 'list') {
        open = { kind: 'list', items: [] };
        blocks.push(open);
      }
      open.items.push(line.slice(2).trim());
    } else {
      if (open?.kind !== 'paragraph') {
        open = { kind: 'paragraph', lines: [] };
        blocks.push(open);
      }
      open.lines.push(line);
    }
  }

  return blocks;
}

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

export default function PostBody({ body }: { body: string }) {
  return (
    <>
      {parseBlocks(body).map((block, index) => {
        const key = String(index);

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
