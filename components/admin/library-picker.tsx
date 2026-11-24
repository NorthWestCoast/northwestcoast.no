'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/articles';
import { COVER_MIN_WIDTH, type LibraryImage, matchesSearch } from '@/lib/media-library';
import { resolveImage } from '@/lib/post-markdown';
import { IMAGE_TYPES, fetchLibrary, imageProblem, uploadPublicImage } from '@/lib/portal/upload-image';

type Props = {
  open: boolean;
  /** Flere bilder (bildeblokk) eller ett (forsidebilde). */
  multiple: boolean;
  /** Språket beskrivelsen vises på, og som blir bildeteksten. */
  lang: 'no' | 'en';
  title: string;
  onClose: () => void;
  onPick: (images: LibraryImage[]) => void;
};

/** Beskrivelsen på språket som er valgt, eller tom tekst. */
export function libraryText(image: LibraryImage, lang: 'no' | 'en'): string {
  return (lang === 'en' ? image.alt_en : image.alt_no) || '';
}

/** Miniatyr av et bilde i public-media, krympet av next/image der det går. */
export function LibraryThumb({ image, sizes = '180px' }: { image: LibraryImage; sizes?: string }) {
  const src = resolveImage(image.storage_path);
  if (!src) return <span className="pt-library-missing">Finnes ikke</span>;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      style={{ objectFit: 'cover' }}
      unoptimized={!canOptimizeImage(src)}
    />
  );
}

/**
 * Velg bilder fra biblioteket, eller last opp nye. Nye bilder havner i
 * biblioteket og blir valgt med en gang. Bruker sesjonen til den som er
 * innlogget: bare administrator og media ser biblioteket (RLS).
 */
export default function LibraryPicker({ open, multiple, lang, title, onClose, onPick }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      setSelected([]);
      setQuery('');
      setError('');
      setStatus('');
      setImages(null);
      fetchLibrary()
        .then(setImages)
        .catch((problem: unknown) => {
          setImages([]);
          setError(problem instanceof Error ? problem.message : 'Biblioteket kunne ikke leses.');
        });
    }
    if (!open && element.open) element.close();
  }, [open]);

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((other) => other !== id);
      return multiple ? [...current, id] : [id];
    });
  }

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []);
    setInputKey((key) => key + 1);
    if (!list.length) return;
    setError('');

    const problems = list.map(imageProblem).filter((problem): problem is string => Boolean(problem));
    if (problems.length) {
      setError(problems.join(' '));
      return;
    }

    setBusy(true);
    const added: LibraryImage[] = [];
    try {
      for (const [index, file] of (multiple ? list : list.slice(0, 1)).entries()) {
        setStatus(`Laster opp ${index + 1} av ${multiple ? list.length : 1}…`);
        const result = await uploadPublicImage(file);
        // Fikk ikke bildet en rad i biblioteket, kan det likevel brukes nå.
        added.push(
          result.library ?? {
            id: result.path,
            storage_path: result.path,
            file_name: file.name,
            alt_no: null,
            alt_en: null,
            width: null,
            height: null,
            bytes: null,
            created_at: new Date().toISOString(),
          },
        );
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Bildene ble ikke lastet opp. Prøv igjen.');
    } finally {
      setBusy(false);
      setImages((current) => [...added, ...(current ?? [])]);
      setSelected((current) => (multiple ? [...current, ...added.map((image) => image.id)] : added.slice(-1).map((image) => image.id)));
      setStatus(
        added.length
          ? `${added.length === 1 ? 'Bildet er lastet opp og valgt' : `${added.length} bilder er lastet opp og valgt`}.`
          : '',
      );
    }
  }

  function confirm() {
    const byId = new Map((images ?? []).map((image) => [image.id, image]));
    const chosen = selected.map((id) => byId.get(id)).filter((image): image is LibraryImage => Boolean(image));
    if (!chosen.length) return;
    onPick(chosen);
    onClose();
  }

  const shown = (images ?? []).filter((image) => matchesSearch(image, query));
  const count = selected.length;

  return (
    <dialog
      ref={dialog}
      className="pt-library-dialog"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // Et klikk på bakteppet utenfor ruta lukker den.
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="pt-library-dialog-inner">
        <div className="pt-library-dialog-head">
          <h2>{title}</h2>
          <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" onClick={onClose}>Lukk</button>
        </div>

        <div className="pt-library-toolbar">
          <input
            className="pt-input"
            type="search"
            placeholder="Søk i beskrivelse og filnavn"
            aria-label="Søk i biblioteket"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="pt-btn pt-btn-ghost" disabled={busy} onClick={() => picker.current?.click()}>
            {busy ? status || 'Laster opp…' : multiple ? 'Last opp nye bilder' : 'Last opp et nytt bilde'}
          </button>
          <input
            ref={picker}
            key={inputKey}
            type="file"
            multiple={multiple}
            hidden
            accept={Object.keys(IMAGE_TYPES).join(',')}
            onChange={(event) => upload(event.target.files)}
          />
        </div>

        <div className="pt-library-dialog-body">
          {error && <p className="pt-msg" data-ok="false" role="alert">{error}</p>}
          {images === null ? (
            <p className="pt-hint">Henter biblioteket…</p>
          ) : shown.length === 0 ? (
            <p className="pt-hint">
              {images.length ? 'Ingen bilder passer søket.' : 'Biblioteket er tomt. Last opp de første bildene over.'}
            </p>
          ) : (
            <ul className="pt-library-grid">
              {shown.map((image) => {
                const position = selected.indexOf(image.id);
                const text = libraryText(image, lang);
                const narrow = !multiple && image.width !== null && image.width < COVER_MIN_WIDTH;
                return (
                  <li key={image.id}>
                    <button
                      type="button"
                      className="pt-library-item"
                      aria-pressed={position >= 0}
                      onClick={() => toggle(image.id)}
                      onDoubleClick={() => {
                        if (!multiple) {
                          setSelected([image.id]);
                          onPick([image]);
                          onClose();
                        }
                      }}
                    >
                      <span className="pt-library-thumb">
                        <LibraryThumb image={image} />
                        {position >= 0 && <span className="pt-library-badge">{multiple ? position + 1 : '✓'}</span>}
                      </span>
                      <span className="pt-library-caption" data-missing={text ? undefined : ''}>
                        {text || (lang === 'en' ? 'Mangler engelsk beskrivelse' : 'Mangler beskrivelse')}
                      </span>
                      <span className="pt-library-meta">
                        {image.width && image.height ? `${image.width} × ${image.height}` : image.file_name ?? ''}
                        {narrow && ' · smalt for forsidebilde'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="pt-library-dialog-foot">
          <span className="pt-hint">
            {!busy && status && <span role="status">{status} </span>}
            {multiple
              ? 'Beskrivelsen blir bildeteksten. Du kan endre den etterpå.'
              : `Forsidebildet bør være minst ${COVER_MIN_WIDTH} piksler bredt.`}
          </span>
          <div className="pt-actions">
            <button type="button" className="pt-btn pt-btn-ghost" onClick={onClose}>Avbryt</button>
            <button type="button" className="pt-btn" disabled={!count || busy} onClick={confirm}>
              {!multiple ? 'Bruk bildet' : count > 1 ? `Legg til ${count} bilder` : count === 1 ? 'Legg til bildet' : 'Legg til'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
