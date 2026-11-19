'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ActionResult } from '@/lib/portal/forms';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2000;

/**
 * Krymper bildet før opplasting. Mobilkameraer leverer 5–12 MB per bilde, og
 * om bord er dekningen ofte dårlig. Klarer ikke nettleseren å lese formatet
 * (HEIC utenfor Safari), sendes originalen som den er.
 */
async function prepare(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  const fallback = {
    blob: file as Blob,
    ext: (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg',
    type: file.type || 'image/jpeg',
  };

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000 && file.type === 'image/jpeg') return fallback;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return fallback;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? { blob, ext: 'jpg', type: 'image/jpeg' } : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Velg bilder (eller ta dem med kameraet), last opp rett til lagring, og meld
 * stiene til en server action som knytter dem til riktig rad.
 *
 * Opplastingen går fra nettleseren med brukerens egen sesjon. Lagringspolicyene
 * avgjør om mappen er lov å skrive til, så `folder` kan ikke misbrukes.
 *
 * Action-en får feltene i `fields`, pluss `photos`: en JSON-liste med
 * { path, captured_at }.
 */
export default function PhotoUploader({
  bucket,
  folder,
  action,
  fields,
  max = 8,
  label = 'Legg til bilder',
  submitLabel = 'Last opp',
}: {
  bucket: string;
  folder: string;
  action: (formData: FormData) => Promise<ActionResult>;
  fields?: Record<string, string>;
  max?: number;
  label?: string;
  submitLabel?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [inputKey, setInputKey] = useState(0);

  function pick(list: FileList | null) {
    setResult(null);
    const picked = Array.from(list ?? []);
    const valid = picked.filter((f) => (ALLOWED.includes(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name)));
    if (valid.length < picked.length) {
      setResult({ ok: false, error: 'Bare bilder (JPG, PNG, WebP, HEIC) kan lastes opp.' });
    }
    setFiles(valid.slice(0, max));
  }

  async function upload() {
    if (files.length === 0) return;
    setBusy(true);
    setResult(null);

    const supabase = createClient();
    const uploaded: { path: string; captured_at: string }[] = [];
    let failed = 0;

    for (const [index, file] of files.entries()) {
      setProgress(`Laster opp ${index + 1} av ${files.length}…`);
      const { blob, ext, type } = await prepare(file);
      if (blob.size > MAX_BYTES) { failed += 1; continue; }

      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type, upsert: false });
      if (error) {
        console.error('[upload]', error.message);
        failed += 1;
        continue;
      }
      uploaded.push({ path, captured_at: new Date(file.lastModified || Date.now()).toISOString() });
    }

    if (uploaded.length === 0) {
      setBusy(false);
      setProgress('');
      setResult({ ok: false, error: 'Ingen bilder ble lastet opp. Sjekk dekningen og prøv igjen.' });
      return;
    }

    setProgress('Lagrer…');
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields ?? {})) formData.set(name, value);
    formData.set('photos', JSON.stringify(uploaded));

    const saved = await action(formData);
    setBusy(false);
    setProgress('');
    if (saved.ok) {
      setFiles([]);
      setInputKey((key) => key + 1);
      setResult(failed > 0
        ? { ok: true, message: `${saved.message} ${failed} bilde(r) ble ikke lastet opp.` }
        : saved);
    } else {
      setResult(saved);
    }
  }

  return (
    <div className="pt-drop">
      <label className="pt-label" htmlFor={`photos-${folder}`}>{label}</label>
      <input
        key={inputKey}
        id={`photos-${folder}`}
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        onChange={(event) => pick(event.target.files)}
      />
      <span className="pt-hint">Inntil {max} bilder. På mobil kan du ta bildene direkte med kameraet.</span>
      <div className="pt-form-foot">
        <button type="button" className="pt-btn" onClick={upload} disabled={busy || files.length === 0}>
          {busy ? progress || 'Laster opp…' : `${submitLabel}${files.length ? ` (${files.length})` : ''}`}
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
