'use client';

import { useRef, useState } from 'react';

type ImageFile = { name: string; type: string; dataUrl: string };

export default function MaintenanceForm() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const accepted: ImageFile[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) {
        setError(`Bildet "${file.name}" er for stort (maks 5 MB).`);
        continue;
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      accepted.push({ name: file.name, type: file.type, dataUrl });
    }
    setImages((prev) => [...prev, ...accepted]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          boat: data.boat,
          imo: data.imo,
          serial: data.serial,
          notes: data.notes,
          images,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Noe gikk galt. Prøv igjen.');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mnt-success">
        <div className="mnt-success-icon" aria-hidden="true">✓</div>
        <h3>Vedlikehold registrert</h3>
        <p>Takk! Rapporten er sendt til NorthWest Coast. Vi tar kontakt ved behov.</p>
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
            >
              + Legg ved bilder
            </button>
            {images.length > 0 && (
              <ul className="mnt-file-list">
                {images.map((img, i) => (
                  <li key={`${img.name}-${i}`}>
                    <span className="mnt-file-name">{img.name}</span>
                    <button
                      type="button"
                      className="mnt-file-remove"
                      onClick={() => removeImage(i)}
                      aria-label={`Fjern ${img.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mnt-error">{error}</p>}

      <button type="submit" className="btn-primary mnt-submit" disabled={loading}>
        {loading ? 'Sender…' : 'Send inn vedlikehold →'}
      </button>
    </form>
  );
}
