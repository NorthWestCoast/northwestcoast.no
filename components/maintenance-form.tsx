'use client';

import { useRef, useState } from 'react';
import { useLang, useT } from '@/components/lang-provider';
import { track } from '@/lib/analytics';
import { prepareImage, type PreparedImage } from '@/lib/images';
import { createClient } from '@/lib/supabase/client';

/**
 * Vedlikeholdsskjema.
 *
 * Bildene lastes opp DIREKTE fra nettleseren til Supabase Storage med
 * signerte URL-er. De går aldri gjennom vår egen server – tidligere ble de
 * sendt som base64 i JSON-bodyen, og ett 5 MB-bilde ble 6,7 MB, godt over
 * Vercels 4,5 MB grense.
 *
 * Flyten er derfor i tre steg:
 *   1. POST /api/maintenance  – lagrer teksten, returnerer signerte URL-er
 *   2. opplasting til Storage – ett kall per bilde, direkte
 *   3. POST /api/maintenance/complete – varsler NWC når bildene ligger der
 *
 * Stopper det opp etter steg 1, er rapporten likevel lagret.
 */

const MAX_IMAGES = 10;
/** Originalen kan være stor – vi komprimerer før opplasting uansett. */
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

type Attachment = PreparedImage & { id: number };

let nextId = 1;

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} kB`;

export default function MaintenanceForm() {
  const lang = useLang();
  const t = useT();
  const [images, setImages] = useState<Attachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    setPreparing(true);

    try {
      const accepted: Attachment[] = [];

      for (const file of Array.from(files)) {
        if (images.length + accepted.length >= MAX_IMAGES) {
          setError(t.maintenance.maxImages(MAX_IMAGES));
          break;
        }
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_ORIGINAL_BYTES) {
          setError(t.maintenance.tooLarge25(file.name));
          continue;
        }

        const prepared = await prepareImage(file);
        accepted.push({ ...prepared, id: nextId++ });
      }

      setImages((prev) => [...prev, ...accepted]);
    } finally {
      setPreparing(false);
      // La samme fil kunne velges på nytt etter at den er fjernet.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeImage(id: number) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPartial(false);

    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

    try {
      // ── 1. Lagre teksten og hent signerte opplastings-URL-er ───────────
      setProgress(t.maintenance.saving);

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          boat: data.boat,
          imo: data.imo,
          serial: data.serial,
          email: data.email,
          notes: data.notes,
          company_website: data.company_website, // honeypot
          lang,
          photos: images.map((img) => ({
            name: img.file.name,
            type: img.file.type,
            capturedAt: img.capturedAt,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.errors.generic);
      }

      const { logId, bucket, uploads } = (await res.json()) as {
        logId: string;
        bucket: string;
        uploads: { index: number; path: string; token: string }[];
      };

      // ── 2. Last opp bildene direkte til Storage ────────────────────────
      let uploaded = 0;

      if (uploads.length > 0) {
        const supabase = createClient();

        for (const [position, upload] of uploads.entries()) {
          // upload.index viser til klientens photos-array, ikke posisjonen
          // her – serveren kan ha hoppet over bilder den ikke godtok.
          const image = images[upload.index];
          if (!image) continue;

          setProgress(t.maintenance.uploadingImage(position + 1, uploads.length));

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .uploadToSignedUrl(upload.path, upload.token, image.file);

          if (uploadError) {
            console.error('Opplasting feilet:', uploadError);
            continue;
          }
          uploaded += 1;
        }

        // ── 3. Varsle NWC ────────────────────────────────────────────────
        setProgress(t.maintenance.finishing);
        await fetch('/api/maintenance/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId, lang }),
        }).catch(() => {
          // Rapporten er lagret uansett; varselet kan tas av en
          // opprydningsjobb. Ikke vis dette som en feil for mannskapet.
        });
      }

      track('Service: Maintenance logged', { props: { photos: uploaded } });
      setPartial(uploaded < uploads.length);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  if (submitted) {
    return (
      <div className="mnt-success">
        <div className="mnt-success-icon" aria-hidden="true">✓</div>
        <h3>{t.maintenance.successTitle}</h3>
        <p>{t.maintenance.successBody}</p>
        {partial && (
          <p className="mnt-warning">
            {t.maintenance.partialWarning}{' '}
            <a href="mailto:arve@astep.no">arve@astep.no</a>.
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="mnt-form" onSubmit={handleSubmit}>
      <div className="mnt-form-head">
        <h2>{t.maintenance.formTitle}</h2>
        <p>{t.maintenance.formSub}</p>
      </div>

      <div className="mnt-table">
        <div className="mnt-row">
          <label htmlFor="name">{t.maintenance.name}</label>
          <input id="name" name="name" type="text" placeholder={t.maintenance.namePlaceholder} required />
        </div>
        <div className="mnt-row">
          <label htmlFor="boat">{t.maintenance.boat}</label>
          <input id="boat" name="boat" type="text" placeholder={t.maintenance.boatPlaceholder} required />
        </div>
        <div className="mnt-row">
          <label htmlFor="imo">{t.maintenance.imo}</label>
          <input id="imo" name="imo" type="text" placeholder={t.maintenance.imoPlaceholder} />
        </div>
        <div className="mnt-row">
          <label htmlFor="serial">{t.maintenance.serial}</label>
          <input id="serial" name="serial" type="text" placeholder={t.maintenance.serialPlaceholder} required />
        </div>
        <div className="mnt-row">
          <label htmlFor="email">{t.maintenance.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder={t.maintenance.emailPlaceholderReceipt}
            autoComplete="email"
          />
        </div>
        <div className="mnt-row">
          <label htmlFor="notes">{t.maintenance.notes}</label>
          <textarea
            id="notes"
            name="notes"
            placeholder={t.maintenance.notesPlaceholder}
          />
        </div>
        <div className="mnt-row mnt-row-files">
          <label htmlFor="images">{t.maintenance.images}</label>
          <div className="mnt-files">
            <input
              id="images"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="mnt-file-input"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              className="mnt-file-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={preparing || images.length >= MAX_IMAGES}
            >
              {preparing ? t.maintenance.processing : t.maintenance.addImages}
            </button>

            {images.length > 0 && (
              <ul className="mnt-file-list">
                {images.map((img) => (
                  <li key={img.id}>
                    <span className="mnt-file-name">{img.file.name}</span>
                    <span className="mnt-file-size">
                      {img.bytes < img.originalBytes
                        ? `${formatBytes(img.originalBytes)} → ${formatBytes(img.bytes)}`
                        : formatBytes(img.bytes)}
                    </span>
                    <button
                      type="button"
                      className="mnt-file-remove"
                      onClick={() => removeImage(img.id)}
                      aria-label={`${t.maintenance.removeImage} ${img.file.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mnt-file-hint">
              {t.maintenance.compressHint}
            </p>
          </div>
        </div>
      </div>

      {/* Honeypot – skjult for mennesker, fylles ut av bots */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hp-field"
      />

      {error && <p className="mnt-error">{error}</p>}

      <button type="submit" className="btn-primary mnt-submit" disabled={loading || preparing}>
        {loading ? (progress ?? t.maintenance.sending) : t.maintenance.submit}
      </button>
    </form>
  );
}
