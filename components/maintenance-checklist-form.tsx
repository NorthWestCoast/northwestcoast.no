'use client';

import { useRef, useState } from 'react';
import { getDict, type Lang } from '@/lib/i18n';
import { CHECKLISTS, checklistItems, type ChecklistKind } from '@/lib/maintenance-checklists';
import { isImageFile, uploadPhotos, type UploadedFile } from '@/components/portal/photo-uploader';

/** Det skjemaet sender. Teksten på punktene legges på av serveren. */
export type RegisterInput = {
  checklist: ChecklistKind | null;
  /** Avkrysningene, i samme rekkefølge som punktene. */
  checked: boolean[];
  paperForm: boolean;
  performedAt: string;
  title: string;
  notes: string;
  name?: string;
  email?: string;
};

export type RegisterResult = { ok: true; logId: string } | { ok: false; error: string };
export type FinishResult = { ok: boolean; receipt?: string | null };

type Kind = ChecklistKind | 'other';
type Method = 'online' | 'paper';

const BUCKET = 'maintenance-photos';
const MAX_PHOTOS = 10;

/**
 * Registrering av vedlikehold: en av sjekklistene fra brukermanualen, eller
 * annet vedlikehold. Sjekklisten kan hukes av her, eller registreres som et
 * bilde av et utfylt papirskjema.
 *
 * Er ikke alle punktene huket av, spør skjemaet om det skal sendes inn som
 * ufullstendig.
 *
 * Brukes i Min side (innlogget) og på lenkesiden /registrer (uten
 * innlogging). Forskjellen ligger i de to serverhandlingene:
 * - `submit` lagrer registreringen og svarer med id-en,
 * - `finish` knytter bildene, som nettleseren har lastet opp i mellomtiden.
 */
export default function MaintenanceChecklistForm({
  lang,
  today,
  minDate,
  askName,
  submit,
  finish,
}: {
  lang: Lang;
  /** Dagens dato (ÅÅÅÅ-MM-DD) i norsk tid, fra serveren. */
  today: string;
  minDate?: string;
  /** Lenkesiden: spør etter navn og e-post. I Min side kommer navnet fra profilen. */
  askName: boolean;
  submit: (input: RegisterInput) => Promise<RegisterResult>;
  finish: (logId: string, photos: UploadedFile[]) => Promise<FinishResult>;
}) {
  const t = getDict(lang).maintenanceForm;
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [kind, setKind] = useState<Kind>('quarterly');
  const [method, setMethod] = useState<Method>('online');
  const [checked, setChecked] = useState<boolean[]>([]);
  const [performedAt, setPerformedAt] = useState(today);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { incomplete: boolean; photosFailed: boolean; receipt: string | null }>(null);

  const checklist = kind === 'other' ? null : kind;
  const items = checklist ? checklistItems(lang, checklist) : [];
  const paper = checklist !== null && method === 'paper';
  const missing = checklist && !paper ? items.filter((_, index) => !checked[index]) : [];

  function chooseKind(next: Kind) {
    setKind(next);
    setChecked([]);
    setError('');
  }

  function toggle(index: number) {
    setChecked((previous) => {
      const next = [...previous];
      next[index] = !next[index];
      return next;
    });
  }

  function pick(list: FileList | null) {
    const picked = Array.from(list ?? []).filter(isImageFile);
    const all = [...files, ...picked];
    setError(all.length > MAX_PHOTOS ? t.maxPhotos(MAX_PHOTOS) : '');
    setFiles(all.slice(0, MAX_PHOTOS));
    setFileKey((key) => key + 1);
  }

  function validate(): string {
    if (askName && !name.trim()) return t.needName;
    if (paper && files.length === 0) return t.needPaperPhoto;
    if (!checklist && !title.trim() && !notes.trim()) return t.needText;
    return '';
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;

    if (missing.length > 0) {
      dialogRef.current?.showModal();
      return;
    }
    void send();
  }

  async function send() {
    dialogRef.current?.close();
    setBusy(true);
    setError('');
    setProgress(t.sending);

    try {
      const result = await submit({
        checklist,
        checked: items.map((_, index) => checked[index] === true),
        paperForm: paper,
        performedAt,
        title: checklist ? '' : title,
        notes,
        ...(askName ? { name, email } : {}),
      });

      // Uten svar er siden på vei et annet sted, f.eks. i demovisningen, der
      // middleware stopper innsendingen og laster siden på nytt.
      if (!result) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { uploaded, failed } = files.length
        ? await uploadPhotos(BUCKET, result.logId, files, (i, n) => setProgress(t.uploading(i, n)))
        : { uploaded: [], failed: 0 };

      setProgress(t.sending);
      const finished = await finish(result.logId, uploaded);

      setDone({
        incomplete: missing.length > 0,
        photosFailed: failed > 0 || (files.length > 0 && !finished.ok),
        receipt: finished.receipt ?? null,
      });
    } catch (caught) {
      console.error('[vedlikehold]', caught);
      setError(t.failed);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function reset() {
    setDone(null);
    setChecked([]);
    setTitle('');
    setNotes('');
    setFiles([]);
    setFileKey((key) => key + 1);
    setPerformedAt(today);
    setMethod('online');
  }

  if (done) {
    return (
      <div className="mf-done" role="status">
        <div className="pt-alert" data-tone={done.incomplete ? 'warn' : 'ok'}>
          <div>
            <strong>{t.doneTitle}</strong>
            <p>{t.doneBody}</p>
            {done.incomplete && <p>{t.doneIncomplete}</p>}
            {done.photosFailed && <p>{t.donePhotosFailed}</p>}
            {done.receipt && <p>{t.doneReceipt(done.receipt)}</p>}
          </div>
        </div>
        <button type="button" className="pt-btn pt-btn-ghost" onClick={reset}>{t.again}</button>
      </div>
    );
  }

  return (
    <>
      <form className="pt-form mf" onSubmit={onSubmit} noValidate>
        <fieldset className="pt-fieldset">
          <legend className="pt-label">{t.kindLabel}</legend>
          <div className="mf-segments">
            {[...CHECKLISTS, 'other' as const].map((value) => (
              <label key={value} className="mf-segment">
                <input
                  type="radio"
                  name="mf-kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => chooseKind(value)}
                />
                <span>{t.kinds[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {checklist && (
          <fieldset className="pt-fieldset">
            <legend className="pt-label">{t.method}</legend>
            <div className="mf-segments mf-segments-two">
              {(['online', 'paper'] as const).map((value) => (
                <label key={value} className="mf-segment">
                  <input
                    type="radio"
                    name="mf-method"
                    value={value}
                    checked={method === value}
                    onChange={() => { setMethod(value); setError(''); }}
                  />
                  <span>{value === 'online' ? t.methodOnline : t.methodPaper}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="pt-form-row">
          <div className="pt-field">
            <label htmlFor="mf-date">{t.date}</label>
            <input
              id="mf-date"
              type="date"
              value={performedAt}
              max={today}
              min={minDate}
              required
              onChange={(event) => setPerformedAt(event.target.value)}
            />
          </div>
        </div>

        {checklist && !paper && (
          <fieldset className="pt-fieldset">
            <legend className="pt-label">{t.checklistLegend}</legend>
            <div className="mf-checks">
              {items.map((item, index) => (
                <label key={item} className="mf-check">
                  <input type="checkbox" checked={checked[index] === true} onChange={() => toggle(index)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {paper && <p className="pt-hint mf-paper-hint">{t.paperHint}</p>}

        {!checklist && (
          <div className="pt-field">
            <label htmlFor="mf-title">{t.title}</label>
            <input
              id="mf-title"
              maxLength={160}
              value={title}
              placeholder={t.titlePlaceholder}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
        )}

        <div className="pt-field">
          <label htmlFor={`mf-photos-${fileKey}`}>{paper ? t.paperPhotos : t.photos}</label>
          <div className="mf-files">
            <label className="pt-btn pt-btn-ghost pt-btn-sm mf-file-btn">
              {t.addPhotos}
              <input
                key={fileKey}
                id={`mf-photos-${fileKey}`}
                type="file"
                accept="image/*"
                multiple
                disabled={files.length >= MAX_PHOTOS}
                onChange={(event) => pick(event.target.files)}
              />
            </label>
            {files.length > 0 && (
              <ul className="mf-file-list">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      className="pt-link"
                      onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                    >
                      {t.removePhoto}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className="pt-hint">{t.photoHint}</span>
        </div>

        <div className="pt-field">
          <label htmlFor="mf-notes">{t.notes}</label>
          <textarea
            id="mf-notes"
            maxLength={4000}
            value={notes}
            placeholder={t.notesPlaceholder}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {askName && (
          <div className="pt-form-row">
            <div className="pt-field">
              <label htmlFor="mf-name">{t.name}</label>
              <input
                id="mf-name"
                autoComplete="name"
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="pt-field">
              <label htmlFor="mf-email">{t.email}</label>
              <input
                id="mf-email"
                type="email"
                autoComplete="email"
                maxLength={160}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <span className="pt-hint">{t.emailHint}</span>
            </div>
          </div>
        )}

        <div className="pt-form-foot">
          <button type="submit" className="pt-btn pt-btn-green" disabled={busy}>
            {busy ? progress || t.sending : t.submit}
          </button>
          {error && <span className="pt-msg" data-ok="false" role="alert">{error}</span>}
        </div>
      </form>

      <dialog ref={dialogRef} className="mf-dialog" aria-labelledby="mf-dialog-title">
        <h2 id="mf-dialog-title">{t.incompleteTitle}</h2>
        <p>{t.incompleteBody(missing.length)}</p>
        <ul>
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="pt-hint">{t.incompleteNote}</p>
        <div className="mf-dialog-actions">
          <button type="button" className="pt-btn pt-btn-ghost" onClick={() => dialogRef.current?.close()} autoFocus>
            {t.incompleteBack}
          </button>
          <button type="button" className="pt-btn" onClick={() => void send()}>
            {t.incompleteSend}
          </button>
        </div>
      </dialog>
    </>
  );
}
