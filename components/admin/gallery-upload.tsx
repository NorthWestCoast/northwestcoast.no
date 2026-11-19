'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/images';
import type { ActionResult } from '@/lib/portal/forms';
import { BUCKETS } from '@/lib/portal/storage';

/** Det bøtta public-media tar imot. */
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_BYTES = 8 * 1024 * 1024;
/** Samme grenser som i addImages. */
const MAX_FILES = 12;
const CAPTION_MAX = 60;

type Category = { value: string; label: string };

type Draft = {
  key: string;
  file: File;
  /** Forhåndsvisning (object URL). Frigis når bildet fjernes eller er lastet opp. */
  preview: string;
  /** Fila har gjennomsiktige områder, og må lastes opp som den er. */
  transparent: boolean;
  altNo: string;
  altEn: string;
  captionNo: string;
  captionEn: string;
  tag: string;
  contain: boolean;
};

type TextField = 'altNo' | 'altEn' | 'captionNo' | 'captionEn';

/**
 * Har bildet gjennomsiktige områder? Tegner en liten kopi og ser etter
 * punkter som ikke er helt dekkende. JPEG har aldri gjennomsiktighet.
 */
async function hasTransparency(file: File): Promise<boolean> {
  if (file.type === 'image/jpeg' || typeof createImageBitmap !== 'function') return false;
  try {
    const bitmap = await createImageBitmap(file);
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();

    const { data } = context.getImageData(0, 0, size, size);
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 250) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Laster opp ett eller flere bilder til galleriet.
 *
 * Bildene går rett fra nettleseren til bøtta `public-media` (lagringspolicyen
 * slipper bare administratorer og media til), og så meldes stiene og tekstene
 * til en server action som legger dem i galleriet. Store bilder krympes først
 * (lib/images.ts). Bilder med gjennomsiktig bakgrunn lastes opp som de er:
 * krympingen lager JPEG, og da ville bakgrunnen blitt svart.
 */
export default function GalleryUpload({
  action,
  folder,
  categories,
  defaultCategory,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  folder: string;
  categories: Category[];
  defaultCategory: string;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [inputKey, setInputKey] = useState(0);

  // Forhåndsvisningene holder på minne til de frigis. Rydd når siden forlates.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    previews.current = drafts.map((draft) => draft.preview);
  }, [drafts]);
  useEffect(() => {
    const open = previews;
    return () => open.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function pick(list: FileList | null) {
    setResult(null);
    const picked = Array.from(list ?? []);
    const valid = picked.filter((file) => ALLOWED[file.type]);
    const room = Math.max(0, MAX_FILES - drafts.length);

    const added = await Promise.all(
      valid.slice(0, room).map(async (file): Promise<Draft> => {
        const transparent = await hasTransparency(file);
        return {
          key: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          transparent,
          altNo: '',
          altEn: '',
          captionNo: '',
          captionEn: '',
          tag: defaultCategory,
          contain: transparent,
        };
      }),
    );

    setDrafts((current) => [...current, ...added]);
    setInputKey((key) => key + 1);

    const notes: string[] = [];
    if (valid.length < picked.length) notes.push('Bare JPG, PNG, WebP og AVIF kan lastes opp.');
    if (valid.length > room) notes.push(`Du kan laste opp inntil ${MAX_FILES} bilder om gangen.`);
    if (notes.length) setResult({ ok: false, error: notes.join(' ') });
  }

  function change(key: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  }

  function remove(draft: Draft) {
    setResult(null);
    URL.revokeObjectURL(draft.preview);
    setDrafts((current) => current.filter((other) => other.key !== draft.key));
  }

  async function upload() {
    if (busy || drafts.length === 0) return;

    const missing = drafts.findIndex((draft) => draft.altNo.trim().length < 2);
    if (missing >= 0) {
      setResult({ ok: false, error: `Skriv en beskrivelse på norsk til bilde ${missing + 1}.` });
      document.getElementById(`gal-${drafts[missing].key}-altNo`)?.focus();
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const supabase = createClient();
      const uploaded: Record<string, string | boolean>[] = [];
      const done = new Set<string>();

      for (const [index, draft] of drafts.entries()) {
        setProgress(`Laster opp ${index + 1} av ${drafts.length}…`);

        const file = draft.transparent ? draft.file : await compressImage(draft.file);
        const ext = ALLOWED[file.type];
        if (!ext || file.size > MAX_BYTES) continue;

        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(BUCKETS.media)
          .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
        if (error) {
          console.error('[galleri]', error.message);
          continue;
        }

        uploaded.push({
          path,
          alt_no: draft.altNo.trim(),
          alt_en: draft.altEn.trim(),
          caption_no: draft.captionNo.trim(),
          caption_en: draft.captionEn.trim(),
          tag: draft.tag,
          contain: draft.contain,
        });
        done.add(draft.key);
      }

      if (uploaded.length === 0) {
        setResult({
          ok: false,
          error: 'Ingen bilder ble lastet opp. Største tillatte størrelse er 8 MB per bilde. Prøv igjen.',
        });
        return;
      }

      setProgress('Lagrer…');
      const formData = new FormData();
      formData.set('images', JSON.stringify(uploaded));
      formData.set('published', publish ? 'true' : 'false');

      const saved = await action(formData);
      if (!saved.ok) {
        setResult(saved);
        return;
      }

      // De som kom fram, tas ut av lista. Resten står igjen så de kan prøves på nytt.
      const left = drafts.filter((draft) => !done.has(draft.key));
      drafts.filter((draft) => done.has(draft.key)).forEach((draft) => URL.revokeObjectURL(draft.preview));
      setDrafts(left);
      setResult(
        left.length
          ? {
              ok: false,
              error: `${saved.message} ${left.length === 1 ? 'Ett bilde' : `${left.length} bilder`} ble ikke lastet opp og står igjen under. Største tillatte størrelse er 8 MB.`,
            }
          : saved,
      );
    } catch (error) {
      console.error('[galleri]', error);
      setResult({ ok: false, error: 'Noe gikk galt under opplastingen. Prøv igjen.' });
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  const textField = (draft: Draft, field: TextField, label: string, maxLength: number, required = false) => (
    <div className="pt-field">
      <label htmlFor={`gal-${draft.key}-${field}`}>{label}</label>
      <input
        id={`gal-${draft.key}-${field}`}
        type="text"
        maxLength={maxLength}
        required={required}
        disabled={busy}
        value={draft[field]}
        onChange={(event) => change(draft.key, { [field]: event.target.value })}
      />
    </div>
  );

  return (
    <div className="pt-form">
      <div className="pt-drop">
        <label className="pt-label" htmlFor="gal-files">Velg bilder</label>
        <input
          key={inputKey}
          id="gal-files"
          type="file"
          accept={Object.keys(ALLOWED).join(',')}
          multiple
          disabled={busy || drafts.length >= MAX_FILES}
          onChange={(event) => pick(event.target.files)}
        />
        <span className="pt-hint">
          JPG, PNG, WebP eller AVIF, inntil {MAX_FILES} bilder om gangen. Store bilder krympes før de lastes opp.
        </span>
      </div>

      {drafts.length > 0 && (
        <>
          <p className="pt-hint">
            Skriv kort hva hvert bilde viser, for eksempel «Argostep montert på skutesiden av et fiskefartøy».
            Beskrivelsen leses opp for dem som bruker skjermleser, og hjelper søkemotorer å forstå bildet.
            Bildeteksten er valgfri, står på selve bildet og bør være kort.
          </p>

          <ol className="pt-gal-drafts">
            {drafts.map((draft, index) => (
              <li key={draft.key}>
                <div className="pt-thumb" data-contain={draft.contain}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- forhåndsvisning av en fil som ikke er lastet opp ennå */}
                  <img src={draft.preview} alt={`Forhåndsvisning av bilde ${index + 1}`} />
                </div>
                <div className="pt-form">
                  <div className="pt-form-row">
                    {textField(draft, 'altNo', `Beskrivelse av bilde ${index + 1} (norsk)`, 300, true)}
                    {textField(draft, 'altEn', 'Beskrivelse (engelsk, valgfri)', 300)}
                  </div>
                  <div className="pt-form-row">
                    {textField(draft, 'captionNo', 'Bildetekst (norsk, valgfri)', CAPTION_MAX)}
                    {textField(draft, 'captionEn', 'Bildetekst (engelsk, valgfri)', CAPTION_MAX)}
                  </div>
                  <div className="pt-form-row">
                    <div className="pt-field">
                      <label htmlFor={`gal-${draft.key}-tag`}>Kategori</label>
                      <select
                        id={`gal-${draft.key}-tag`}
                        disabled={busy}
                        value={draft.tag}
                        onChange={(event) => change(draft.key, { tag: event.target.value })}
                      >
                        {categories.map((category) => (
                          <option key={category.value} value={category.value}>{category.label}</option>
                        ))}
                      </select>
                    </div>
                    <label className="pt-check">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={draft.contain}
                        onChange={(event) => change(draft.key, { contain: event.target.checked })}
                      />
                      <span>
                        Gjennomsiktig bakgrunn
                        <span className="pt-hint"> (hele bildet vises, på sandfarget bunn)</span>
                      </span>
                    </label>
                  </div>
                  <div>
                    <button type="button" className="pt-link" disabled={busy} onClick={() => remove(draft)}>
                      Ta bort dette bildet
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <label className="pt-check">
            <input
              type="checkbox"
              disabled={busy}
              checked={publish}
              onChange={(event) => setPublish(event.target.checked)}
            />
            <span>Vis på nettsiden med en gang</span>
          </label>
        </>
      )}

      <div className="pt-form-foot">
        <button type="button" className="pt-btn" onClick={upload} disabled={busy || drafts.length === 0}>
          {busy ? progress || 'Laster opp…' : `Last opp${drafts.length ? ` (${drafts.length})` : ''}`}
        </button>
        {result && (
          <span className="pt-msg" data-ok={result.ok} role={result.ok ? 'status' : 'alert'}>
            {result.ok ? result.message : result.error}
          </span>
        )}
      </div>
    </div>
  );
}
