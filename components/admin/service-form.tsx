'use client';

import { useState } from 'react';
import { attachServicePhotos, issueCertificate, recordService } from '@/app/(portal)/admin/service/actions';
import { CERTIFICATE_NAME, CERTIFICATE_NAME_LOWER } from '@/lib/portal/labels';
import { nextServiceDue } from '@/lib/portal/service';
import { BUCKETS } from '@/lib/portal/storage';
import { PhotoField, usePhotoQueue, type UploadedPhoto } from './photo-queue';

/**
 * ISO-dato (ÅÅÅÅ-MM-DD) som DD.MM.ÅÅÅÅ. Regnes ut uten Date, så server og
 * nettleser alltid viser det samme, uansett hvilken tidssone nettleseren står i.
 */
const dato = (iso: string) => iso.split('-').reverse().join('.');

export type ServiceLadder = { id: string; label: string; intervalMonths: number };

type Result = 'ok' | 'ok_with_remarks' | 'failed';
type Saved = { reportId: string; ladderId: string; nextDue: string };
type Issued = { id: string; number: string; validUntil: string };
type Receipt = {
  ladder: string;
  ladderId: string;
  nextDue: string;
  photos: number;
  certificate: Issued | null;
  /** Det som ikke ble med, når administratoren avsluttet uten å prøve igjen. */
  missing: string[];
};

type Props = {
  /** Én leider (leidersiden) eller alle (servicesiden, med nedtrekksliste). */
  ladders: ServiceLadder[];
  selected?: string | null;
  performedBy: string;
  /** Dagens dato fra serveren, så server og nettleser tegner det samme. */
  today: string;
  scope: string;
};

/**
 * Registrering av utført service: rapport, bilder og servicesertifikat i ett
 * skjema.
 *
 * Bak skjemaet er det tre steg i fast rekkefølge, fordi bildene ligger i en
 * mappe med rapportens id og sertifikatet utstedes fra rapporten:
 *   1. rapporten lagres, 2. bildene lastes opp, 3. sertifikatet utstedes.
 *
 * Stopper det etter steg 1 (dårlig dekning, en dato databasen avviser), sier
 * skjemaet hva som mangler og låser rapportfeltene: «Prøv igjen» fortsetter
 * der det stoppet og lagrer aldri rapporten to ganger. Det som eventuelt
 * mangler etterpå, står også under «Utførte servicer» på leiderens
 * side og kan fullføres derfra.
 */
export default function ServiceForm(props: Props) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [round, setRound] = useState(0);

  return (
    <div className="pt-stack">
      {receipt && (
        <div className="pt-alert" data-tone={receipt.missing.length > 0 ? 'warn' : 'ok'} role="status" style={{ marginBottom: 0 }}>
          <div>
            <strong>Servicerapporten er lagret på leider {receipt.ladder}</strong>
            <p>
              Neste frist: {dato(receipt.nextDue)}.
              {receipt.photos > 0 && ` ${receipt.photos === 1 ? 'Ett bilde' : `${receipt.photos} bilder`} er lagt ved.`}
              {receipt.certificate && (
                <>
                  {' '}{CERTIFICATE_NAME} {receipt.certificate.number} er utstedt, gyldig til{' '}
                  {dato(receipt.certificate.validUntil)}.{' '}
                  <a
                    href={`/minside/leider/${receipt.ladderId}/sertifikat/${receipt.certificate.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pt-link"
                  >
                    Åpne PDF
                  </a>
                </>
              )}
            </p>
            {receipt.missing.length > 0 && (
              <p>
                Ikke med: {receipt.missing.join(' ')} Det kan legges til under «Utførte servicer» på{' '}
                <a href={`/minside/leider/${receipt.ladderId}#administrasjon`} className="pt-link">leiderens side</a>.
              </p>
            )}
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

function Fields({ ladders, selected, performedBy, today, scope, onDone }: Props & { onDone: (receipt: Receipt) => void }) {
  const single = ladders.length === 1;
  const [ladderId, setLadderId] = useState(single ? ladders[0].id : selected ?? '');
  const [performedAt, setPerformedAt] = useState(today);
  const [nextDue, setNextDue] = useState('');
  const [result, setResult] = useState<Result>('ok');
  const [issue, setIssue] = useState(true);
  /** null: følger neste servicefrist. Ellers det administratoren selv har satt. */
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const queue = usePhotoQueue();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [photos, setPhotos] = useState(0);
  const [certificate, setCertificate] = useState<Issued | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

  const ladder = ladders.find((item) => item.id === ladderId);
  const suggestedDue =
    saved?.nextDue ?? (nextDue || (performedAt && ladder ? nextServiceDue(performedAt, ladder.intervalMonths) : ''));
  const canIssue = result !== 'failed';
  const wantsCertificate = issue && canIssue;
  const certificateUntil = validUntil ?? suggestedDue;
  const locked = saved !== null;
  const field = (name: string) => `${scope}-${name}`;

  const receipt = (report: Saved, photoCount: number, issued: Issued | null, missing: string[]): Receipt => ({
    ladder: ladder?.label ?? '',
    ladderId: report.ladderId,
    nextDue: report.nextDue,
    photos: photoCount,
    certificate: issued,
    missing,
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // Leses før noe annet: feltene låses mens skjemaet arbeider, og låste felt blir ikke med.
    const formData = new FormData(event.currentTarget);
    setError('');
    setProblems([]);

    if (wantsCertificate && !certificate && !(certificateUntil > today)) {
      setError(`«Gyldig til» på ${CERTIFICATE_NAME_LOWER} må være en dato etter i dag.`);
      return;
    }

    // 1. Rapporten. Er den lagret fra et tidligere forsøk, lagres den ikke på nytt.
    let report = saved;
    if (!report) {
      setBusy('Lagrer servicerapporten…');
      formData.set('issue_certificate', wantsCertificate ? 'on' : '');
      formData.set('certificate_valid_until', wantsCertificate ? certificateUntil : '');
      const response = await recordService(formData);
      if (!response.ok) {
        setBusy('');
        setError(response.error);
        return;
      }
      report = { reportId: response.reportId, ladderId: response.ladderId, nextDue: response.nextDue };
      setSaved(report);
    }
    const { reportId, ladderId: reportLadder } = report;
    const remaining: string[] = [];

    // 2. Bildene, i rapportens mappe.
    let photoCount = photos;
    if (queue.waiting > 0) {
      const sent = await queue.send(
        BUCKETS.reports,
        `${reportLadder}/${reportId}`,
        (uploaded: UploadedPhoto[]) => {
          const request = new FormData();
          request.set('report_id', reportId);
          request.set('photos', JSON.stringify(uploaded));
          return attachServicePhotos(request);
        },
        setBusy,
      );
      photoCount += sent.attached;
      setPhotos(photoCount);
      remaining.push(...sent.problems);
    }

    // 3. Sertifikatet.
    let issued = certificate;
    if (wantsCertificate && !issued) {
      setBusy(`Utsteder ${CERTIFICATE_NAME_LOWER}…`);
      const request = new FormData();
      request.set('ladder_id', reportLadder);
      request.set('report_id', reportId);
      request.set('valid_until', certificateUntil);
      request.set('remarks', remarks);
      const response = await issueCertificate(request);
      if (response.ok) {
        issued = { id: response.certificateId, number: response.certificateNumber, validUntil: response.validUntil };
        setCertificate(issued);
      } else {
        remaining.push(`${CERTIFICATE_NAME} ble ikke utstedt: ${response.error}`);
      }
    }

    setBusy('');
    if (remaining.length === 0) onDone(receipt(report, photoCount, issued, []));
    else setProblems(remaining);
  }

  const submitLabel = locked
    ? 'Prøv igjen'
    : wantsCertificate
      ? `Lagre og utsted ${CERTIFICATE_NAME_LOWER}`
      : 'Lagre servicerapport';

  return (
    <form onSubmit={submit} className="pt-form">
      {/* Når rapporten er lagret, låses feltene: et nytt forsøk gjelder bare det som mangler. */}
      <fieldset className="pt-form pt-fieldset" disabled={locked || Boolean(busy)}>
        {single ? (
          <input type="hidden" name="ladder_id" value={ladderId} />
        ) : (
          <div className="pt-field">
            <label htmlFor={field('ladder_id')}>Leider</label>
            <select
              id={field('ladder_id')}
              name="ladder_id"
              required
              value={ladderId}
              onChange={(event) => setLadderId(event.target.value)}
            >
              <option value="" disabled>Velg leider</option>
              {ladders.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-form-row">
          <div className="pt-field">
            <label htmlFor={field('performed_at')}>Utført dato</label>
            <input
              id={field('performed_at')}
              name="performed_at"
              type="date"
              required
              max={today}
              value={performedAt}
              onChange={(event) => setPerformedAt(event.target.value)}
            />
          </div>
          <div className="pt-field">
            <label htmlFor={field('performed_by')}>Utført av</label>
            <input id={field('performed_by')} name="performed_by" required maxLength={120} defaultValue={performedBy} />
          </div>
        </div>

        <div className="pt-form-row">
          <div className="pt-field">
            <label htmlFor={field('result')}>Resultat</label>
            <select
              id={field('result')}
              name="result"
              required
              value={result}
              onChange={(event) => setResult(event.target.value as Result)}
            >
              <option value="ok">Godkjent</option>
              <option value="ok_with_remarks">Godkjent med anmerkning</option>
              <option value="failed">Ikke godkjent</option>
            </select>
          </div>
          <div className="pt-field">
            <label htmlFor={field('next_service_due')}>Neste frist</label>
            <input
              id={field('next_service_due')}
              name="next_service_due"
              type="date"
              min={performedAt || undefined}
              value={nextDue}
              onChange={(event) => setNextDue(event.target.value)}
            />
            <small>
              {nextDue || !suggestedDue || !ladder
                ? 'Tom: beregnes fra leiderens serviceintervall.'
                : `Tom: ${dato(suggestedDue)} (${ladder.intervalMonths} måneder etter servicen).`}
            </small>
          </div>
        </div>

        <div className="pt-field">
          <label htmlFor={field('findings')}>Funn</label>
          <textarea
            id={field('findings')}
            name="findings"
            rows={4}
            maxLength={4000}
            placeholder="Tilstand, utskiftede deler, avvik."
          />
        </div>
      </fieldset>

      <PhotoField queue={queue} id={field('photos')} label="Bilder fra servicen" disabled={Boolean(busy)} />

      <div className="pt-subform">
        <label className="pt-check">
          <input
            type="checkbox"
            checked={wantsCertificate}
            disabled={!canIssue || certificate !== null || Boolean(busy)}
            onChange={(event) => setIssue(event.target.checked)}
          />
          <span>
            <strong>Utsted {CERTIFICATE_NAME_LOWER}</strong>
            <span className="pt-hint" style={{ display: 'block' }}>
              Kunden får varsel og kan laste det ned som PDF. Det erstatter det som gjaldt fra før.
            </span>
          </span>
        </label>

        {!canIssue && (
          <p className="pt-hint">
            Leideren er ikke godkjent, så {CERTIFICATE_NAME_LOWER} kan ikke utstedes. Registrer en ny service når
            manglene er rettet.
          </p>
        )}

        {certificate && (
          <p className="pt-msg" data-ok="true">
            {CERTIFICATE_NAME} {certificate.number} er utstedt, gyldig til {dato(certificate.validUntil)}.
          </p>
        )}

        {wantsCertificate && !certificate && (
          <>
            <div className="pt-form-row">
              <div className="pt-field">
                <label htmlFor={field('valid_until')}>Gyldig til</label>
                <input
                  id={field('valid_until')}
                  type="date"
                  required
                  disabled={Boolean(busy)}
                  value={certificateUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
                <small>Forslaget er neste servicefrist.</small>
              </div>
            </div>
            <div className="pt-field">
              <label htmlFor={field('remarks')}>Merknad (valgfritt)</label>
              <textarea
                id={field('remarks')}
                rows={2}
                maxLength={2000}
                disabled={Boolean(busy)}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder={`Står på ${CERTIFICATE_NAME_LOWER}, f.eks. en anmerkning kunden må følge opp.`}
              />
            </div>
          </>
        )}
      </div>

      {problems.length > 0 && (
        <div className="pt-alert" data-tone="warn" role="alert" style={{ marginBottom: 0 }}>
          <div>
            <strong>Servicerapporten er lagret, men ikke alt ble med</strong>
            {problems.map((problem) => <p key={problem}>{problem}</p>)}
            <p>
              Prøv igjen her, eller fullfør senere under «Utførte servicer» på leiderens side. Rapporten
              lagres ikke på nytt.
            </p>
          </div>
        </div>
      )}

      <div className="pt-form-foot">
        <button type="submit" className="pt-btn" disabled={Boolean(busy)}>
          {busy || submitLabel}
        </button>
        {locked && !busy && saved && (
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={() => onDone(receipt(saved, photos, certificate, problems))}
          >
            Avslutt uten resten
          </button>
        )}
        {error && <span className="pt-msg" data-ok="false" role="alert">{error}</span>}
      </div>
    </form>
  );
}
