'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BUCKETS } from '@/lib/portal/storage';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Ett bilde til en nyhet eller et produkt.
 *
 * Bildet lastes opp fra nettleseren til den offentlige bøtta `public-media`
 * (lagringspolicyen slipper bare administratorer til). Adressen legges i et
 * skjult felt, så skjemaet rundt lagrer den sammen med resten. En adresse
 * kan også limes inn direkte.
 */
export default function MediaUpload({
  name = 'cover_image_url',
  defaultValue = '',
  folder = 'posts',
  label = 'Forsidebilde',
}: {
  name?: string;
  defaultValue?: string;
  folder?: string;
  label?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inputKey, setInputKey] = useState(0);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');

    const ext = ALLOWED[file.type];
    if (!ext) {
      setError('Bildet må være JPG, PNG, WebP eller AVIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Bildet er for stort. Største tillatte størrelse er 8 MB.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKETS.media)
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
    setBusy(false);
    setInputKey((key) => key + 1);

    if (uploadError) {
      console.error('[media]', uploadError.message);
      setError('Bildet ble ikke lastet opp. Prøv igjen.');
      return;
    }
    setUrl(supabase.storage.from(BUCKETS.media).getPublicUrl(path).data.publicUrl);
  }

  const previewable = /^(https:\/\/|\/)/.test(url);

  return (
    <div className="pt-drop">
      <input type="hidden" name={name} value={url} />

      <label className="pt-label" htmlFor={`${name}-file`}>{label}</label>
      <input
        key={inputKey}
        id={`${name}-file`}
        type="file"
        accept={Object.keys(ALLOWED).join(',')}
        disabled={busy}
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <span className="pt-hint">
        {busy ? 'Laster opp…' : 'JPG, PNG, WebP eller AVIF, inntil 8 MB. Liggende format passer best.'}
      </span>

      <label className="pt-label" htmlFor={`${name}-url`}>Eller lim inn en bildeadresse</label>
      <input
        id={`${name}-url`}
        className="pt-input"
        type="url"
        inputMode="url"
        placeholder="https://…"
        value={url}
        onChange={(event) => setUrl(event.target.value.trim())}
      />

      {error && <span className="pt-msg" data-ok="false" role="alert">{error}</span>}

      {url && previewable && (
        <div className="pt-photos">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- forhåndsvisning av en vilkårlig adresse */}
            <img src={url} alt="Forhåndsvisning av forsidebildet" />
          </figure>
        </div>
      )}
      {url && (
        <div>
          <button type="button" className="pt-link" onClick={() => setUrl('')}>Fjern bildet</button>
        </div>
      )}
    </div>
  );
}
