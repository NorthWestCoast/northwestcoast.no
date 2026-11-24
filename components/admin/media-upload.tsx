'use client';

import { useEffect, useRef, useState } from 'react';
import { COVER_MIN_WIDTH, LIBRARY_FOLDER } from '@/lib/media-library';
import {
  IMAGE_TYPES,
  SET_MEDIA_EVENT,
  type SetMediaDetail,
  libraryUrl,
  uploadPublicImage,
} from '@/lib/portal/upload-image';
import LibraryPicker from './library-picker';

/**
 * Ett bilde til en nyhet eller et produkt.
 *
 * Bildet velges fra bildebiblioteket, eller lastes opp fra nettleseren til
 * den offentlige bøtta `public-media` (lagringspolicyen slipper bare
 * administratorer og media til) og havner da også i biblioteket. Adressen
 * legges i et skjult felt, så skjemaet rundt lagrer den sammen med resten.
 * En adresse kan også limes inn direkte.
 *
 * .md-importen setter bildet utenfra med hendelsen SET_MEDIA_EVENT, og en
 * endring meldes med et input-event (forhåndsvisningen lytter på det).
 */
export default function MediaUpload({
  name = 'cover_image_url',
  defaultValue = '',
  folder = LIBRARY_FOLDER,
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
  const [choosing, setChoosing] = useState(false);
  // Bredden på bildet som sist ble valgt eller lastet opp (ukjent for innlimte adresser).
  const [width, setWidth] = useState<number | null>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const onSet = (event: Event) => {
      const detail = (event as CustomEvent<SetMediaDetail>).detail;
      if (detail?.name === name) {
        setUrl(detail.url);
        setWidth(null);
      }
    };
    window.addEventListener(SET_MEDIA_EVENT, onSet);
    return () => window.removeEventListener(SET_MEDIA_EVENT, onSet);
  }, [name]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    hidden.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [url]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const result = await uploadPublicImage(file, folder);
      setUrl(result.url);
      setWidth(result.library?.width ?? null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Bildet ble ikke lastet opp. Prøv igjen.');
    } finally {
      setBusy(false);
      setInputKey((key) => key + 1);
    }
  }

  const previewable = /^(https:\/\/|\/)/.test(url);

  return (
    <div className="pt-drop">
      <input ref={hidden} type="hidden" name={name} value={url} />

      <label className="pt-label" htmlFor={`${name}-file`}>{label}</label>
      {folder === LIBRARY_FOLDER && (
        <div>
          <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" disabled={busy} onClick={() => setChoosing(true)}>
            Velg fra biblioteket
          </button>
          <LibraryPicker
            open={choosing}
            multiple={false}
            lang="no"
            title="Velg forsidebilde"
            onClose={() => setChoosing(false)}
            onPick={([image]) => {
              if (!image) return;
              setError('');
              setUrl(libraryUrl(image.storage_path));
              setWidth(image.width);
            }}
          />
        </div>
      )}
      <input
        key={inputKey}
        id={`${name}-file`}
        type="file"
        accept={Object.keys(IMAGE_TYPES).join(',')}
        disabled={busy}
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <span className="pt-hint">
        {busy
          ? 'Laster opp…'
          : `Eller last opp et nytt: JPG, PNG, WebP eller AVIF. Liggende format, minst ${COVER_MIN_WIDTH} piksler bredt, passer best.`}
      </span>

      <label className="pt-label" htmlFor={`${name}-url`}>Eller lim inn en bildeadresse</label>
      <input
        id={`${name}-url`}
        className="pt-input"
        // Ikke type="url": bilder fra nettstedet har relative adresser (/images/…),
        // og dem ville nettleseren nektet å sende.
        type="text"
        inputMode="url"
        spellCheck={false}
        placeholder="https://… eller /images/…"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value.trim());
          setWidth(null);
        }}
      />

      {error && <span className="pt-msg" data-ok="false" role="alert">{error}</span>}
      {url && width !== null && width < COVER_MIN_WIDTH && (
        <span className="pt-msg" data-ok="false">
          Bildet er {width} piksler bredt. Google og delingstjenestene viser forsidebildet best når det er minst{' '}
          {COVER_MIN_WIDTH} piksler.
        </span>
      )}

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
          <button type="button" className="pt-link" onClick={() => { setUrl(''); setWidth(null); }}>Fjern bildet</button>
        </div>
      )}
    </div>
  );
}
