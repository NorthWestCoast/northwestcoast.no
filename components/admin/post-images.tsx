'use client';

import { useEffect, useRef, useState } from 'react';
import {
  findGalleries,
  formatGallery,
  resolveImage,
  shortImageRef,
  type GalleryEntry,
  type GallerySpan,
} from '@/lib/post-markdown';
import type { LibraryImage } from '@/lib/media-library';
import { fetchLibrary } from '@/lib/portal/upload-image';
import LibraryPicker, { libraryText } from './library-picker';

type Props = {
  /** Tekstfeltet bildene hører til (body_no eller body_en). */
  field: string;
  label: string;
  /** Språket teksten er på. Beskrivelsen i biblioteket på dette språket blir bildeteksten. */
  lang: 'no' | 'en';
  /** Feltet med den andre språkversjonen, så bildene kan hentes derfra. */
  copyFrom?: { field: string; label: string };
};

function textarea(root: HTMLElement | null, name: string): HTMLTextAreaElement | null {
  const field = root?.closest('form')?.elements.namedItem(name);
  return field instanceof HTMLTextAreaElement ? field : null;
}

/** Skriver ny tekst i feltet og sier fra, så forhåndsvisningen og lista følger med. */
function write(area: HTMLTextAreaElement, value: string) {
  area.value = value;
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Setter inn en bildeblokk ved `at`, med en blank linje før og etter. */
function insertBlock(text: string, at: number, block: string): string {
  const before = text.slice(0, at).replace(/\s+$/, '');
  const after = text.slice(at).replace(/^\s+/, '');
  return [before, block, after].filter(Boolean).join('\n\n');
}

/**
 * Bildene i én brødtekst, vist som en liste med miniatyr, bildetekst og
 * knapper for rekkefølge. Lista er en annen visning av bildeblokkene
 * («:::bilder») i tekstfeltet. Alt som endres her, skrives tilbake dit, og
 * endringer i tekstfeltet vises her. Teksten er det som lagres.
 */
export default function PostImages({ field, label, lang, copyFrom }: Props) {
  const copyField = copyFrom?.field;
  const root = useRef<HTMLDivElement>(null);
  const [spans, setSpans] = useState<GallerySpan[]>([]);
  const [otherHasImages, setOtherHasImages] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [choosing, setChoosing] = useState(false);
  // Har tekstfeltet hatt fokus? Da settes en ny bildeblokk der markøren sto.
  const focused = useRef(false);

  useEffect(() => {
    const area = textarea(root.current, field);
    const other = copyField ? textarea(root.current, copyField) : null;
    if (!area) return;

    const update = () => {
      setSpans(findGalleries(area.value));
      setOtherHasImages(Boolean(other && findGalleries(other.value).some((span) => span.images.length)));
    };
    const onFocus = () => { focused.current = true; };

    update();
    area.addEventListener('input', update);
    area.addEventListener('focus', onFocus);
    other?.addEventListener('input', update);
    return () => {
      area.removeEventListener('input', update);
      area.removeEventListener('focus', onFocus);
      other?.removeEventListener('input', update);
    };
  }, [field, copyField]);

  /** Skriver én bildeblokk på nytt. En tom blokk fjernes helt. */
  function replaceSpan(index: number, images: GalleryEntry[]) {
    const area = textarea(root.current, field);
    const span = findGalleries(area?.value ?? '')[index];
    if (!area || !span) return;
    const text = area.value;
    if (images.length) {
      write(area, text.slice(0, span.start) + formatGallery(images) + text.slice(span.end));
    } else {
      const before = text.slice(0, span.start).replace(/\s+$/, '');
      const after = text.slice(span.end).replace(/^\s+/, '');
      write(area, [before, after].filter(Boolean).join('\n\n'));
    }
  }

  function move(block: number, from: number, to: number) {
    const images = [...spans[block].images];
    if (to < 0 || to >= images.length) return;
    const [image] = images.splice(from, 1);
    images.splice(to, 0, image);
    setDrafts({});
    replaceSpan(block, images);
  }

  function remove(block: number, index: number) {
    setDrafts({});
    replaceSpan(block, spans[block].images.filter((_, i) => i !== index));
  }

  function caption(block: number, index: number, value: string) {
    setDrafts((current) => ({ ...current, [`${block}:${index}`]: value }));
    replaceSpan(block, spans[block].images.map((image, i) => (i === index ? { ...image, caption: value } : image)));
  }

  /** Nye bilder: til slutt i den siste blokken, eller i en ny blokk der markøren står. */
  function addImages(entries: GalleryEntry[]) {
    const area = textarea(root.current, field);
    if (!area || !entries.length) return;
    const current = findGalleries(area.value);
    if (current.length) {
      const last = current.length - 1;
      replaceSpan(last, [...current[last].images, ...entries]);
    } else {
      const at = focused.current ? area.selectionStart : area.value.length;
      write(area, insertBlock(area.value, at, formatGallery(entries)));
    }
  }

  function pick(images: LibraryImage[]) {
    addImages(images.map((image) => ({ ref: image.storage_path, caption: libraryText(image, lang) })));
    const missing = images.filter((image) => !libraryText(image, lang)).length;
    setStatus(
      `${images.length === 1 ? 'Bildet er lagt til' : `${images.length} bilder er lagt til`}.` +
        (missing ? ` Skriv bildetekst til ${missing === 1 ? 'det som mangler' : `de ${missing} som mangler`}.` : ''),
    );
  }

  /** Samme bilder som i den andre teksten, med beskrivelsene fra biblioteket på dette språket. */
  async function copyImages() {
    const other = copyFrom ? textarea(root.current, copyFrom.field) : null;
    if (!other) return;
    const library = await fetchLibrary().catch(() => [] as LibraryImage[]);
    const byPath = new Map(library.map((image) => [image.storage_path, image]));
    const images = findGalleries(other.value).flatMap((span) =>
      span.images.map(({ ref }) => {
        const image = byPath.get(shortImageRef(ref));
        return { ref, caption: image ? libraryText(image, lang) : '' };
      }),
    );
    addImages(images);
    const missing = images.filter((image) => !image.caption).length;
    setStatus(
      missing
        ? `Bildene er hentet. Skriv ${missing === images.length ? 'bildetekstene' : `de ${missing} bildetekstene som mangler`} på dette språket.`
        : 'Bildene er hentet med bildetekstene fra biblioteket.',
    );
  }

  const total = spans.reduce((sum, span) => sum + span.images.length, 0);

  return (
    <div ref={root} className="pt-post-images">
      <div className="pt-post-images-head">
        <span className="pt-label">{label}{total ? ` (${total})` : ''}</span>
        <div className="pt-actions">
          {copyFrom && otherHasImages && !total && (
            <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" onClick={copyImages}>
              Bruk bildene fra {copyFrom.label}
            </button>
          )}
          <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" onClick={() => { setStatus(''); setChoosing(true); }}>
            Legg til bilder
          </button>
        </div>
      </div>
      <LibraryPicker
        open={choosing}
        multiple
        lang={lang}
        title={`Legg til bilder: ${label.toLowerCase()}`}
        onClose={() => setChoosing(false)}
        onPick={pick}
      />

      {total === 0 ? (
        <p className="pt-hint">
          Ingen bilder ennå. Bildene vises som et lysbildeshow der bildeblokken står i teksten. En ny blokk havner der
          markøren sist sto i tekstfeltet, ellers nederst.
        </p>
      ) : (
        spans.map((span, block) => (
          <ol key={block} className="pt-post-images-list">
            {span.images.map((image, index) => {
              const src = resolveImage(image.ref);
              const key = `${block}:${index}`;
              return (
                <li key={`${key}:${image.ref}`}>
                  <span className="pt-post-images-thumb">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatyr av et opplastet bilde
                      <img src={src} alt="" />
                    ) : (
                      <span title={image.ref}>Finnes ikke</span>
                    )}
                  </span>
                  <input
                    className="pt-input"
                    value={drafts[key] ?? image.caption}
                    placeholder="Bildetekst (vises under bildet og leses opp for blinde)"
                    aria-label={`Bildetekst til bilde ${index + 1}`}
                    maxLength={300}
                    onChange={(event) => caption(block, index, event.target.value)}
                    onBlur={() => setDrafts((current) => {
                      const next = { ...current };
                      delete next[key];
                      return next;
                    })}
                  />
                  <span className="pt-post-images-tools">
                    <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" aria-label="Flytt opp" disabled={index === 0} onClick={() => move(block, index, index - 1)}>↑</button>
                    <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" aria-label="Flytt ned" disabled={index === span.images.length - 1} onClick={() => move(block, index, index + 1)}>↓</button>
                    <button type="button" className="pt-btn pt-btn-danger pt-btn-sm" onClick={() => remove(block, index)}>Fjern</button>
                  </span>
                </li>
              );
            })}
          </ol>
        ))
      )}

      {status && <span className="pt-msg" data-ok="true" role="status">{status}</span>}
    </div>
  );
}
