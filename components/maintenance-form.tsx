'use client';

import { useRef, useState } from 'react';
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
          setError(`Maks ${MAX_IMAGES} bilder per rapport.`);
          break;
        }
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_ORIGINAL_BYTES) {
          setError(`Bildet "${file.name}" er for stort (maks 25 MB).`);
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
      setProgress('Lagrer rapport…');

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
          photos: images.map((img) => ({
            name: img.file.name,
            type: img.file.type,
            capturedAt: img.capturedAt,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Noe gikk galt. Prøv igjen.');
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

          setProgress(`Laster opp bilde ${position + 1} av ${uploads.length}…`);

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
        setProgress('Fullfører…');
        await fetch('/api/maintenance/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId }),
        }).catch(() => {
          // Rapporten er lagret uansett; varselet kan tas av en
          // opprydningsjobb. Ikke vis dette som en feil for mannskapet.
        });
      }

      track('Service: Maintenance logged', { props: { photos: uploaded } });
      setPartial(uploaded < uploads.length);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  if (submitted) {
    return (
      <div className="mnt-success">
        <div className="mnt-success-icon" aria-hidden="true">✓</div>
        <h3>Vedlikehold registrert</h3>
        <p>
          Takk! Rapporten er sendt til NorthWest Coast. Oppga du e-post, har du fått en
          kvittering du kan bruke som dokumentasjon ved tilsyn.
        </p>
        {partial && (
          <p className="mnt-warning">
            Merk: ikke alle bildene ble lastet opp – sannsynligvis dårlig dekning.
            Selve rapporten er registrert. Send gjerne bildene til{' '}
            <a href="mailto:arve@astep.no">arve@astep.no</a>.
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="mnt-form" onSubmit={handleSubmit}>
      <div className="mnt-form-head">
        <h2>Registrer vedlikehold</h2>
        <p>Fyll inn opplysningene under og legg gjerne ved bilder av leideren.</p>
      </div>

      <div className="mnt-table">
        <div className="mnt-row">
          <label htmlFor="name">Navn *</label>
          <input id="name" name="name" type="text" placeholder="Ditt navn" required />
        </div>
        <div className="mnt-row">
          <label htmlFor="boat">Navn på båt *</label>
          <input id="boat" name="boat" type="text" placeholder="F.eks. MS Havbris" required />
        </div>
        <div className="mnt-row">
          <label htmlFor="imo">IMO nr</label>
          <input id="imo" name="imo" type="text" placeholder="F.eks. 9074729" />
        </div>
        <div className="mnt-row">
          <label htmlFor="serial">Serienummer på leider *</label>
          <input id="serial" name="serial" type="text" placeholder="F.eks. ARG-2024-0142" required />
        </div>
        <div className="mnt-row">
          <label htmlFor="email">E-post</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="For kvittering du kan vise ved tilsyn"
            autoComplete="email"
          />
        </div>
        <div className="mnt-row">
          <label htmlFor="notes">Kommentar</label>
          <textarea
            id="notes"
            name="notes"
            placeholder="Beskriv utført vedlikehold, tilstand eller avvik (valgfritt)"
          />
        </div>
        <div className="mnt-row mnt-row-files">
          <label htmlFor="images">Bilder</label>
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
              {preparing ? 'Behandler…' : '+ Legg ved bilder'}
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
                      aria-label={`Fjern ${img.file.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mnt-file-hint">
              Bildene komprimeres automatisk før opplasting, så de går raskt
              også med dårlig dekning om bord.
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
        {loading ? (progress ?? 'Sender…') : 'Send inn vedlikehold →'}
      </button>
    </form>
  );
}
