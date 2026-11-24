'use client';

import { useRef, useState } from 'react';
import {
  formatPostFile,
  galleryEntries,
  imageFileKey,
  isLocalImageName,
  mapGalleryRefs,
  parsePostFile,
  resolveImage,
  type PostFileFields,
} from '@/lib/post-markdown';
import { AI_GUIDE, GUIDE_FILENAME, POST_TEMPLATE, TEMPLATE_FILENAME } from '@/lib/post-template';
import { LIBRARY_FOLDER } from '@/lib/media-library';
import {
  IMAGE_TYPES,
  SET_MEDIA_EVENT,
  type SetMediaDetail,
  fieldValue,
  imageProblem,
  setFieldValue,
  uploadPublicImage,
} from '@/lib/portal/upload-image';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isMarkdown = (file: File) => /\.(md|markdown|txt)$/i.test(file.name);

type Result = { ok: boolean; message: string; notes: string[] };

/**
 * Skriv med AI eller importer .md: last ned malen og veiledningen, og les
 * inn ei ferdig fil med bildene. Importen fyller bare ut skjemaet. Ingenting
 * lagres eller publiseres før man trykker Lagre.
 */
export default function PostFileTools() {
  const root = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const form = () => root.current?.closest('form') ?? null;

  function exportPost() {
    const f = form();
    const fields = Object.fromEntries(
      (['title_no', 'title_en', 'slug', 'published_date', 'tag_no', 'tag_en', 'excerpt_no', 'excerpt_en', 'cover_image_url', 'body_no', 'body_en'] as const)
        .map((name) => [name, fieldValue(f, name)]),
    ) as PostFileFields;
    download(`${fields.slug || 'nyhet'}.md`, formatPostFile(fields));
  }

  async function importFiles(files: FileList | null) {
    const list = Array.from(files ?? []);
    setInputKey((key) => key + 1);
    const f = form();
    if (!list.length || !f) return;
    setResult(null);

    const texts = list.filter(isMarkdown);
    if (texts.length !== 1) {
      setResult({ ok: false, message: texts.length ? 'Velg bare én .md-fil om gangen.' : 'Fant ingen .md-fil blant filene du valgte.', notes: [] });
      return;
    }
    const images = new Map(list.filter((file) => !isMarkdown(file)).map((file) => [imageFileKey(file.name), file]));

    const { fields, notes } = parsePostFile(await texts[0].text());

    // Filnavn i fila som må lastes opp: forsidebildet og bildene i bildeblokkene.
    const wanted = new Set(
      [...galleryEntries(fields.body_no), ...galleryEntries(fields.body_en)]
        .map((entry) => entry.ref)
        .concat(fields.cover_image_url ? [fields.cover_image_url] : [])
        .filter(isLocalImageName)
        .map(imageFileKey),
    );
    const missing = [...wanted].filter((key) => !images.has(key));
    if (missing.length) {
      setResult({
        ok: false,
        message: `Fila viser til ${missing.length === 1 ? 'et bilde' : 'bilder'} som ikke var med: ${missing.join(', ')}. Velg .md-fila og alle bildene samtidig.`,
        notes: [],
      });
      return;
    }
    const problems = [...wanted].map((key) => imageProblem(images.get(key)!)).filter(Boolean);
    if (problems.length) {
      setResult({ ok: false, message: problems.join(' '), notes: [] });
      return;
    }

    const filled = fieldValue(f, 'title_no').trim() || fieldValue(f, 'body_no').trim();
    if (filled && !window.confirm('Importen erstatter det som står i skjemaet nå. Vil du fortsette?')) return;

    // Bildetekstene i fila blir beskrivelsene i biblioteket, så bildene kan brukes igjen.
    const captions = new Map<string, { no?: string; en?: string }>();
    for (const [lang, body] of [['no', fields.body_no], ['en', fields.body_en]] as const) {
      for (const entry of galleryEntries(body)) {
        if (!isLocalImageName(entry.ref) || !entry.caption) continue;
        const key = imageFileKey(entry.ref);
        captions.set(key, { ...captions.get(key), [lang]: captions.get(key)?.[lang] ?? entry.caption });
      }
    }

    const uploaded = new Map<string, { path: string; url: string }>();
    try {
      let count = 0;
      for (const key of wanted) {
        setBusy(`Laster opp bilde ${++count} av ${wanted.size}…`);
        uploaded.set(key, await uploadPublicImage(images.get(key)!, LIBRARY_FOLDER, captions.get(key)));
      }
    } catch (problem) {
      setBusy('');
      setResult({ ok: false, message: problem instanceof Error ? problem.message : 'Bildene ble ikke lastet opp.', notes: [] });
      return;
    }
    setBusy('');

    const swap = (ref: string) => (isLocalImageName(ref) ? uploaded.get(imageFileKey(ref))?.path ?? ref : ref);
    // Forsidebildet lagres som full adresse, så det også vises som miniatyr i skjemaet.
    const cover = !fields.cover_image_url
      ? ''
      : isLocalImageName(fields.cover_image_url)
        ? uploaded.get(imageFileKey(fields.cover_image_url))?.url ?? ''
        : resolveImage(fields.cover_image_url) ?? '';
    if (fields.cover_image_url && !cover) {
      notes.push(`Forsidebildet «${fields.cover_image_url}» kan ikke brukes og ble hoppet over. Last det opp i skjemaet.`);
    }

    setFieldValue(f, 'title_no', fields.title_no);
    setFieldValue(f, 'title_en', fields.title_en);
    setFieldValue(f, 'slug', fields.slug);
    setFieldValue(f, 'tag_no', fields.tag_no || 'Nyheter');
    setFieldValue(f, 'tag_en', fields.tag_en || 'News');
    setFieldValue(f, 'excerpt_no', fields.excerpt_no);
    setFieldValue(f, 'excerpt_en', fields.excerpt_en);
    setFieldValue(f, 'published_date', fields.published_date);
    setFieldValue(f, 'body_no', mapGalleryRefs(fields.body_no, swap));
    setFieldValue(f, 'body_en', mapGalleryRefs(fields.body_en, swap));
    window.dispatchEvent(new CustomEvent<SetMediaDetail>(SET_MEDIA_EVENT, { detail: { name: 'cover_image_url', url: cover } }));

    const unused = [...images.keys()].filter((key) => !wanted.has(key));
    if (unused.length) notes.push(`Ikke brukt i fila, og derfor ikke lastet opp: ${unused.join(', ')}.`);

    setResult({
      ok: true,
      message:
        `Skjemaet er fylt ut${uploaded.size ? ` og ${uploaded.size} ${uploaded.size === 1 ? 'bilde er' : 'bilder er'} lagt i biblioteket` : ''}. ` +
        'Se over forhåndsvisningen nederst, og trykk Lagre. Ingenting er lagret ennå.',
      notes,
    });
  }

  return (
    <div ref={root}>
      <details className="pt-fold">
        <summary>Skriv med AI eller importer en .md-fil</summary>
        <div className="pt-form">
          <ol className="pt-post-steps">
            <li>
              Last ned veiledningen og gi den til en AI-assistent (for eksempel Claude) sammen med det saken skal
              handle om og bildene. Be om ei .md-fil.
            </li>
            <li>
              Velg .md-fila og bildene samtidig med «Importer .md». Skjemaet fylles ut, og bildene lastes opp til
              biblioteket med bildetekstene som beskrivelse.
            </li>
            <li>Se over forhåndsvisningen, rett det som trengs, og lagre.</li>
          </ol>
          <div className="pt-actions">
            <button type="button" className="pt-btn" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>
              {busy || 'Importer .md'}
            </button>
            <button type="button" className="pt-btn pt-btn-ghost" onClick={() => download(GUIDE_FILENAME, AI_GUIDE)}>
              Last ned veiledning for AI
            </button>
            <button type="button" className="pt-btn pt-btn-ghost" onClick={() => download(TEMPLATE_FILENAME, POST_TEMPLATE)}>
              Last ned mal
            </button>
            <button type="button" className="pt-btn pt-btn-ghost" onClick={exportPost}>
              Last ned innlegget som .md
            </button>
            <input
              ref={picker}
              key={inputKey}
              type="file"
              multiple
              hidden
              accept={['.md', '.markdown', '.txt', 'text/markdown', 'text/plain', ...Object.keys(IMAGE_TYPES)].join(',')}
              onChange={(event) => importFiles(event.target.files)}
            />
          </div>
          {result && (
            <div>
              <span className="pt-msg" data-ok={result.ok} role={result.ok ? 'status' : 'alert'}>{result.message}</span>
              {result.notes.length > 0 && (
                <ul className="pt-post-preview-notes">
                  {result.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
