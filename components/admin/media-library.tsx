'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/portal/forms';
import type { ActionResult } from '@/lib/portal/forms';
import { type LibraryImage, type PostUse, formatBytes, matchesSearch } from '@/lib/media-library';
import { resolveImage } from '@/lib/post-markdown';
import { IMAGE_TYPES, imageProblem, uploadPublicImage } from '@/lib/portal/upload-image';
import { LibraryThumb } from './library-picker';

type Action = (formData: FormData) => Promise<ActionResult>;
type Item = LibraryImage & { uses: PostUse[] };

/** Så mange bilder kan lastes opp i én omgang. De lastes opp ett og ett. */
const MAX_BATCH = 100;

const dateFormat = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Oslo' });

/** Ett bilde: miniatyr, beskrivelsene, størrelse og hvor det brukes. */
function LibraryCard({ image, updateAction, deleteAction }: { image: Item; updateAction: Action; deleteAction: Action }) {
  const [altNo, setAltNo] = useState(image.alt_no ?? '');
  const [altEn, setAltEn] = useState(image.alt_en ?? '');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const src = resolveImage(image.storage_path);
  const dirty = altNo.trim() !== (image.alt_no ?? '') || altEn.trim() !== (image.alt_en ?? '');
  const name = image.alt_no || image.file_name || 'bildet';

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => setResult(await updateAction(formData)));
  }

  return (
    <li className="pt-library-card">
      <a className="pt-library-thumb" href={src ?? undefined} target="_blank" rel="noreferrer" aria-label={`Åpne ${name} i full størrelse`}>
        <LibraryThumb image={image} sizes="(max-width: 640px) 100vw, 320px" />
      </a>
      <div className="pt-library-card-body">
        <form onSubmit={save} className="pt-library-card-form">
          <input type="hidden" name="image_id" value={image.id} />
          <label className="pt-label" htmlFor={`alt-no-${image.id}`}>Beskrivelse</label>
          <textarea
            id={`alt-no-${image.id}`}
            name="alt_no"
            className="pt-input"
            rows={2}
            maxLength={300}
            placeholder="Hva viser bildet? Blir bildeteksten."
            value={altNo}
            onChange={(event) => { setAltNo(event.target.value); setResult(null); }}
          />
          <label className="pt-label" htmlFor={`alt-en-${image.id}`}>Engelsk</label>
          <input
            id={`alt-en-${image.id}`}
            name="alt_en"
            className="pt-input"
            maxLength={300}
            value={altEn}
            onChange={(event) => { setAltEn(event.target.value); setResult(null); }}
          />
          <div className="pt-actions">
            <button type="submit" className="pt-btn pt-btn-sm" disabled={!dirty || pending}>
              {pending ? 'Lagrer…' : 'Lagre'}
            </button>
            {result && (
              <span className="pt-msg" data-ok={result.ok} role={result.ok ? 'status' : 'alert'}>
                {result.ok ? result.message : result.error}
              </span>
            )}
          </div>
        </form>

        <p className="pt-library-meta">
          {[
            image.width && image.height ? `${image.width} × ${image.height}` : null,
            formatBytes(image.bytes) || null,
            dateFormat.format(new Date(image.created_at)),
          ].filter(Boolean).join(' · ')}
          {image.file_name && <span className="pt-library-file" title={image.file_name}>{image.file_name}</span>}
        </p>

        {image.uses.length ? (
          <p className="pt-library-uses">
            Brukes i{' '}
            {image.uses.map((post, index) => (
              <span key={post.id}>
                {index > 0 && ', '}
                <Link href={`/admin/nyheter/${post.id}`}>{post.title}</Link>
              </span>
            ))}
          </p>
        ) : (
          <div className="pt-library-uses">
            <span className="pt-muted">Ikke i bruk</span>
            <ActionButton
              action={deleteAction}
              fields={{ image_id: image.id }}
              label="Slett"
              tone="danger"
              confirm={`Slette «${name}» fra biblioteket? Fila slettes og kan ikke hentes tilbake.`}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Bibliotekssiden: last opp mange bilder på en gang (dra dem inn eller velg),
 * søk, skriv beskrivelser og slett bilder som ikke er i bruk.
 */
export default function MediaLibrary({
  images,
  updateAction,
  deleteAction,
}: {
  images: Item[];
  updateAction: Action;
  deleteAction: Action;
}) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [inputKey, setInputKey] = useState(0);

  async function upload(files: File[]) {
    setInputKey((key) => key + 1);
    if (!files.length || busy) return;
    setMessage(null);

    const images = files.filter((file) => IMAGE_TYPES[file.type]);
    const skipped = files.length - images.length;
    const problems = images.map(imageProblem).filter((problem): problem is string => Boolean(problem));
    if (problems.length) {
      setMessage({ ok: false, error: problems.join(' ') });
      return;
    }
    const batch = images.slice(0, MAX_BATCH);

    let done = 0;
    const failed: string[] = [];
    for (const file of batch) {
      setBusy(`Laster opp ${done + failed.length + 1} av ${batch.length}…`);
      try {
        await uploadPublicImage(file);
        done++;
      } catch (problem) {
        failed.push(problem instanceof Error ? problem.message : `«${file.name}» ble ikke lastet opp.`);
      }
    }
    setBusy('');
    router.refresh();

    const notes = [
      done ? `${done === 1 ? 'Bildet er lagt' : `${done} bilder er lagt`} i biblioteket. Skriv en beskrivelse til hvert, så er bildeteksten klar når bildet velges.` : '',
      ...failed,
      skipped ? `${skipped} ${skipped === 1 ? 'fil' : 'filer'} ble hoppet over: bare JPG, PNG, WebP og AVIF.` : '',
      images.length > MAX_BATCH ? `Bare de ${MAX_BATCH} første ble lastet opp. Ta resten i en ny omgang.` : '',
    ].filter(Boolean).join(' ');
    setMessage(failed.length || !done ? { ok: false, error: notes } : { ok: true, message: notes });
  }

  const missing = images.filter((image) => !image.alt_no).length;
  const shown = images.filter((image) => matchesSearch(image, query) && (!onlyMissing || !image.alt_no));

  return (
    <>
      <div
        className="pt-library-drop"
        data-over={over || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          upload(Array.from(event.dataTransfer.files));
        }}
      >
        <div>
          <strong>Dra bildene hit</strong>
          <span className="pt-hint">
            Eller velg dem fra maskinen. Mange om gangen går fint. Store bilder krympes til 1600 piksler før de lastes
            opp. JPG, PNG, WebP eller AVIF.
          </span>
        </div>
        <button type="button" className="pt-btn" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>
          {busy || 'Velg bilder'}
        </button>
        <input
          ref={picker}
          key={inputKey}
          type="file"
          multiple
          hidden
          accept={Object.keys(IMAGE_TYPES).join(',')}
          onChange={(event) => upload(Array.from(event.target.files ?? []))}
        />
      </div>
      {message && (
        <p className="pt-msg" data-ok={message.ok} role={message.ok ? 'status' : 'alert'}>
          {message.ok ? message.message : message.error}
        </p>
      )}

      <div className="pt-library-toolbar">
        <input
          className="pt-input"
          type="search"
          placeholder="Søk i beskrivelse og filnavn"
          aria-label="Søk i biblioteket"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {missing > 0 && (
          <label className="pt-check">
            <input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />
            Bare uten beskrivelse ({missing})
          </label>
        )}
        <span className="pt-muted">
          {shown.length === images.length ? `${images.length} bilder` : `${shown.length} av ${images.length} bilder`}
        </span>
      </div>

      {images.length === 0 ? (
        <p className="pt-hint">Biblioteket er tomt. Dra inn de første bildene over.</p>
      ) : shown.length === 0 ? (
        <p className="pt-hint">Ingen bilder passer.</p>
      ) : (
        <ul className="pt-library-cards">
          {shown.map((image) => (
            <LibraryCard key={image.id} image={image} updateAction={updateAction} deleteAction={deleteAction} />
          ))}
        </ul>
      )}
    </>
  );
}
