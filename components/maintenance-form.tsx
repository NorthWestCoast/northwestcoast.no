'use client';

import { useRef, useState } from 'react';
import { useLang, useT } from '@/components/lang-provider';
import { EVENTS, track } from '@/lib/analytics';

type ImageFile = { name: string; type: string; dataUrl: string };

export default function MaintenanceForm() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lang = useLang();
  const t = useT();

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const accepted: ImageFile[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) {
        setError(t.maintenance.tooLarge(file.name));
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
          email: data.email,
          boat: data.boat,
          imo: data.imo,
          serial: data.serial,
          notes: data.notes,
          reminder: data.reminder === 'on',
          images,
          lang,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t.errors.generic);
      }
      track(EVENTS.maintenanceLogged, {
        lang,
        withEmail: Boolean(data.email),
        images: images.length,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mnt-success">
        <div className="mnt-success-icon" aria-hidden="true">✓</div>
        <h3>{t.maintenance.successTitle}</h3>
        <p>{t.maintenance.successBody}</p>
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
          <label htmlFor="email">{t.maintenance.email}</label>
          <input id="email" name="email" type="email" placeholder={t.maintenance.emailPlaceholder} />
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
          <label htmlFor="notes">{t.maintenance.notes}</label>
          <textarea id="notes" name="notes" placeholder={t.maintenance.notesPlaceholder} />
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
            >
              {t.maintenance.addImages}
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
                      aria-label={`${t.maintenance.removeImage} ${img.name}`}
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

      <label className="mnt-consent">
        <input type="checkbox" name="reminder" defaultChecked />
        <span>{t.maintenance.consent}</span>
      </label>

      {error && <p className="mnt-error">{error}</p>}

      <button type="submit" className="btn-primary mnt-submit" disabled={loading}>
        {loading ? t.maintenance.sending : t.maintenance.submit}
      </button>
    </form>
  );
}
