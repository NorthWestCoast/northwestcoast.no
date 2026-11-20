'use client';

import { useState } from 'react';
import { attachMaintenancePhotos, createMaintenanceReport } from '@/app/(portal)/admin/vedlikehold/actions';
import { LOG_KINDS } from '@/lib/portal/labels';
import { BUCKETS } from '@/lib/portal/storage';
import { PhotoField, usePhotoQueue, type UploadedPhoto } from './photo-queue';

type Saved = { logId: string; ladderId: string; message: string };
type Receipt = { ladderId: string; message: string; photos: number; missing: string[] };

type Props = {
  ladderId: string;
  /** Forslag til «Utført av»: administratorens eget navn. */
  performedBy: string;
  /** Dagens dato fra serveren, så server og nettleser tegner det samme. */
  today: string;
  scope: string;
};

/**
 * Vedlikeholdsrapport lagt inn av NorthWest Coast, med bilder.
 *
 * Rapporten lagres først, så lastes bildene opp i mappen med rapportens id.
 * Feiler bildene, sier skjemaet det og låser feltene: «Prøv igjen» gjelder
 * bare bildene, og rapporten lagres aldri to ganger.
 */
export default function MaintenanceReportForm(props: Props) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [round, setRound] = useState(0);

  return (
    <div className="pt-stack">
      {receipt && (
        <div className="pt-alert" data-tone={receipt.missing.length > 0 ? 'warn' : 'ok'} role="status" style={{ marginBottom: 0 }}>
          <div>
            <strong>{receipt.message}</strong>
            <p>
              {receipt.photos > 0 && `${receipt.photos === 1 ? 'Ett bilde' : `${receipt.photos} bilder`} er lagt ved. `}
              {receipt.missing.length > 0 && `Ikke med: ${receipt.missing.join(' ')} `}
              Kunden ser rapporten i{' '}
              <a href={`/minside/leider/${receipt.ladderId}?fane=historikk`} className="pt-link">historikken til leideren</a>.
            </p>
          </div>
        </div>
      )}
      <Fields
        key={round}
        {...props}
        onDone={(done) => {
          setReceipt(done);
          setRound((value) => value + 1);
        }}
      />
    </div>
  );
}

function Fields({ ladderId, performedBy, today, scope, onDone }: Props & { onDone: (receipt: Receipt) => void }) {
  const queue = usePhotoQueue();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [photos, setPhotos] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

  const locked = saved !== null;
  const field = (name: string) => `${scope}-${name}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // Leses før noe annet: feltene låses mens skjemaet arbeider, og låste felt blir ikke med.
    const formData = new FormData(event.currentTarget);
    setError('');
    setProblems([]);

    // 1. Rapporten. Er den lagret fra et tidligere forsøk, lagres den ikke på nytt.
    let report = saved;
    if (!report) {
      setBusy('Lagrer rapporten…');
      const response = await createMaintenanceReport(formData);
      if (!response.ok) {
        setBusy('');
        setError(response.error);
        return;
      }
      report = { logId: response.logId, ladderId: response.ladderId, message: response.message };
      setSaved(report);
    }
    const { logId } = report;

    // 2. Bildene, i rapportens mappe.
    let photoCount = photos;
    let remaining: string[] = [];
    if (queue.waiting > 0) {
      const sent = await queue.send(
        BUCKETS.logs,
        logId,
        (uploaded: UploadedPhoto[]) => {
          const request = new FormData();
          request.set('log_id', logId);
          request.set('photos', JSON.stringify(uploaded));
          return attachMaintenancePhotos(request);
        },
        setBusy,
      );
      photoCount += sent.attached;
      setPhotos(photoCount);
      remaining = sent.problems;
    }

    setBusy('');
    if (remaining.length === 0) {
      onDone({ ladderId: report.ladderId, message: report.message, photos: photoCount, missing: [] });
    } else {
      setProblems(remaining);
    }
  }

  return (
    <form onSubmit={submit} className="pt-form">
      <input type="hidden" name="ladder_id" value={ladderId} />

      {/* Når rapporten er lagret, låses feltene: et nytt forsøk gjelder bare bildene. */}
      <fieldset className="pt-form pt-fieldset" disabled={locked || Boolean(busy)}>
        <div className="pt-form-row">
          <div className="pt-field">
            <label htmlFor={field('kind')}>Type</label>
            <select id={field('kind')} name="kind" defaultValue="maintenance" required>
              {Object.entries(LOG_KINDS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="pt-field">
            <label htmlFor={field('performed_at')}>Dato</label>
            <input id={field('performed_at')} name="performed_at" type="date" defaultValue={today} max={today} required />
          </div>
        </div>
        <div className="pt-field">
          <label htmlFor={field('title')}>Tittel</label>
          <input id={field('title')} name="title" maxLength={160} placeholder="F.eks. Byttet sidetau" />
        </div>
        <div className="pt-field">
          <label htmlFor={field('notes')}>Beskrivelse</label>
          <textarea
            id={field('notes')}
            name="notes"
            rows={4}
            maxLength={4000}
            placeholder="Hva ble gjort, og hva ble funnet?"
          />
        </div>
        <div className="pt-field">
          <label htmlFor={field('performed_by')}>Utført av</label>
          <input id={field('performed_by')} name="performed_by" required maxLength={120} defaultValue={performedBy} />
          <small>Navnet kunden ser på rapporten. Bytt det hvis en annen gjorde arbeidet.</small>
        </div>
      </fieldset>

      <PhotoField queue={queue} id={field('photos')} disabled={Boolean(busy)} />

      {problems.length > 0 && (
        <div className="pt-alert" data-tone="warn" role="alert" style={{ marginBottom: 0 }}>
          <div>
            <strong>Rapporten er lagret, men ikke alle bildene ble med</strong>
            {problems.map((problem) => <p key={problem}>{problem}</p>)}
            <p>Prøv igjen når dekningen er bedre. Rapporten lagres ikke på nytt.</p>
          </div>
        </div>
      )}

      <div className="pt-form-foot">
        <button type="submit" className="pt-btn pt-btn-green" disabled={Boolean(busy)}>
          {busy || (locked ? 'Prøv igjen' : 'Lagre rapporten')}
        </button>
        {locked && !busy && saved && (
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={() => onDone({ ladderId: saved.ladderId, message: saved.message, photos, missing: problems })}
          >
            Avslutt uten bildene
          </button>
        )}
        {error && <span className="pt-msg" data-ok="false" role="alert">{error}</span>}
      </div>
    </form>
  );
}
