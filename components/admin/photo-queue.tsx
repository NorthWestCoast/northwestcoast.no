'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { prepareImage } from '@/lib/images';
import type { ActionResult } from '@/lib/portal/forms';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 10 * 1024 * 1024;
/** Så mange stier tar handlingene imot per kall (parseUploadedPhotos). */
const CHUNK = 12;

export type UploadedPhoto = { path: string; captured_at: string | null };

const extension = (file: File) =>
  (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';

const antall = (count: number) => (count === 1 ? 'Ett bilde' : `${count} bilder`);

/**
 * Bilder som hører til et skjema der raden må lagres FØR bildene kan lastes
 * opp (mappen i lagringen er radens id): servicerapporter og
 * vedlikeholdsrapporter fra admin.
 *
 * Skjemaet lagrer raden, og kaller så `send` med mappen. Bildene krympes i
 * nettleseren, lastes opp med brukerens egen sesjon, og stiene meldes til en
 * server action som knytter dem til raden. Det som feiler blir stående i køen
 * til neste forsøk, så et brudd underveis aldri gir bilder som verken er
 * lagret eller meldt.
 */
export function usePhotoQueue(max = CHUNK) {
  const [files, setFiles] = useState<File[]>([]);
  /** Lastet opp, men ikke knyttet til raden ennå (handlingen feilet). */
  const [unattached, setUnattached] = useState<UploadedPhoto[]>([]);
  const [notice, setNotice] = useState('');
  const [inputKey, setInputKey] = useState(0);

  function pick(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const valid = picked.filter((file) => ALLOWED.includes(file.type) || /\.(jpe?g|png|webp|heic)$/i.test(file.name));
    setNotice(
      valid.length < picked.length
        ? 'Bare bilder (JPG, PNG, WebP, HEIC) kan lastes opp.'
        : valid.length > max
          ? `Bare de ${max} første bildene tas med.`
          : '',
    );
    setFiles(valid.slice(0, max));
  }

  async function send(
    bucket: string,
    folder: string,
    attach: (photos: UploadedPhoto[]) => Promise<ActionResult>,
    onProgress: (text: string) => void,
  ): Promise<{ attached: number; problems: string[] }> {
    const supabase = createClient();
    const problems: string[] = [];
    const uploaded: UploadedPhoto[] = [];
    const failed: File[] = [];
    let tooLarge = 0;

    for (const [index, file] of files.entries()) {
      onProgress(`Laster opp bilde ${index + 1} av ${files.length}…`);
      const prepared = await prepareImage(file);
      if (prepared.file.size > MAX_BYTES) { tooLarge += 1; continue; }

      const path = `${folder}/${crypto.randomUUID()}.${extension(prepared.file)}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, prepared.file, { contentType: prepared.file.type || 'image/jpeg', upsert: false });
      if (error) {
        console.error('[upload]', error.message);
        failed.push(file);
        continue;
      }
      uploaded.push({ path, captured_at: prepared.capturedAt });
    }

    if (tooLarge > 0) problems.push(`${antall(tooLarge)} er over 10 MB og ble ikke tatt med.`);
    if (failed.length > 0) problems.push(`${antall(failed.length)} ble ikke lastet opp. Sjekk dekningen.`);

    let pending = [...unattached, ...uploaded];
    let attached = 0;
    if (pending.length > 0) onProgress('Lagrer bildene…');
    while (pending.length > 0) {
      const result = await attach(pending.slice(0, CHUNK));
      if (!result.ok) {
        problems.push(`${antall(pending.length)} er lastet opp, men ble ikke lagret på rapporten: ${result.error}`);
        break;
      }
      attached += Math.min(CHUNK, pending.length);
      pending = pending.slice(CHUNK);
    }

    setFiles(failed);
    setUnattached(pending);
    // Feltet tømmes; det som gjenstår står som tekst under.
    setInputKey((key) => key + 1);
    return { attached, problems };
  }

  return { files, unattached, notice, inputKey, max, pick, send, waiting: files.length + unattached.length };
}

export type PhotoQueue = ReturnType<typeof usePhotoQueue>;

/** Filvelgeren til køen. Selve opplastingen starter når skjemaet sendes. */
export function PhotoField({
  queue,
  id,
  label = 'Bilder',
  disabled = false,
}: {
  queue: PhotoQueue;
  id: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="pt-drop">
      <label className="pt-label" htmlFor={id}>{label}</label>
      <input
        key={queue.inputKey}
        id={id}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => queue.pick(event.target.files)}
      />
      <span className="pt-hint">
        Valgfritt, inntil {queue.max} bilder. De krympes før opplasting. På mobil kan du ta dem med kameraet.
      </span>
      {queue.waiting > 0 && (
        <span className="pt-hint" role="status">
          {queue.waiting === 1 ? 'Ett bilde' : `${queue.waiting} bilder`} lastes opp når du lagrer.
        </span>
      )}
      {queue.notice && <span className="pt-msg" data-ok="false" role="alert">{queue.notice}</span>}
    </div>
  );
}
