'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SET_MEDIA_EVENT, type SetMediaDetail, fieldValue, setFieldValue } from '@/lib/portal/upload-image';

/** Feltene i nyhetsskjemaet som lagres automatisk. */
const FIELDS = [
  'title_no', 'title_en', 'slug', 'tag_no', 'tag_en', 'excerpt_no', 'excerpt_en',
  'body_no', 'body_en', 'cover_image_url', 'status', 'published_date',
] as const;
type Snapshot = Record<(typeof FIELDS)[number], string>;

/** Så lenge det må være stille i skjemaet før det lagres. */
const DELAY_MS = 2500;

function snapshot(form: HTMLFormElement): Snapshot {
  return Object.fromEntries(FIELDS.map((name) => [name, fieldValue(form, name)])) as Snapshot;
}

function normalize(data: unknown): Snapshot {
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return Object.fromEntries(FIELDS.map((name) => [name, typeof row[name] === 'string' ? row[name] : ''])) as Snapshot;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });
const dayAndClock = (iso: string) =>
  `${new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Oslo' })} kl. ${clock(iso)}`;

type Status = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Automatisk lagring av nyhetsskjemaet.
 *
 * Det som står i skjemaet, lagres i post_autosaves et par sekunder etter at
 * man slutter å skrive: én kopi per person og innlegg («ny» for et nytt).
 * Selve innlegget røres ikke, så det som er publisert, endres først når man
 * trykker Lagre (savePost sletter da kopien). Åpner man innlegget igjen og
 * kopien skiller seg fra det som er lagret, kan man hente den inn eller
 * forkaste den.
 */
export default function PostAutosave({ postId, updatedAt }: { postId?: string; updatedAt?: string }) {
  const key = postId ?? 'ny';
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  /** Skjemaet slik det var da siden ble åpnet (eller sist lagret). */
  const baseline = useRef('');
  /** Det som sist ble lagret automatisk, og det som sist ble sendt med Lagre. */
  const lastSaved = useRef('');
  const submitted = useRef('');
  const [status, setStatus] = useState<Status>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [offer, setOffer] = useState<{ data: Snapshot; savedAt: string; older: boolean } | null>(null);
  const paused = useRef(false);
  paused.current = Boolean(offer);
  // Lytterne under settes opp én gang; de leser status herfra.
  const statusRef = useRef<Status>('idle');
  statusRef.current = status;

  const form = () => root.current?.closest('form') ?? null;

  // Ved åpning: finnes det en automatisk lagret kopi som skiller seg fra innlegget?
  useEffect(() => {
    const element = form();
    if (!element) return;
    const current = JSON.stringify(snapshot(element));
    baseline.current = current;
    lastSaved.current = current;
    submitted.current = '';
    setStatus('idle');

    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('post_autosaves')
      .select('data, updated_at')
      .eq('post_key', key)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const saved = normalize(data.data);
        if (JSON.stringify(saved) === current) {
          // Det samme som er lagret: kopien trengs ikke.
          // Spørringen sendes først når den avventes.
          void supabase.from('post_autosaves').delete().eq('post_key', key).then(() => undefined);
          return;
        }
        setOffer({
          data: saved,
          savedAt: data.updated_at,
          older: Boolean(updatedAt && new Date(data.updated_at) < new Date(updatedAt)),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [key, updatedAt]);

  // Lagre et par sekunder etter siste endring, og med en gang når fanen skjules.
  useEffect(() => {
    const element = form();
    if (!element) return;
    const supabase = createClient();

    async function save() {
      timer.current = null;
      const target = form();
      if (!target || paused.current) return;
      const json = JSON.stringify(snapshot(target));
      if (json === lastSaved.current || json === submitted.current) {
        setStatus((value) => (value === 'pending' ? 'idle' : value));
        return;
      }
      if (json === baseline.current) {
        // Alt er tilbake slik det er lagret: kopien trengs ikke lenger.
        lastSaved.current = json;
        setStatus('idle');
        await supabase.from('post_autosaves').delete().eq('post_key', key);
        return;
      }
      setStatus('saving');
      const { data, error } = await supabase
        .from('post_autosaves')
        .upsert({ post_key: key, data: JSON.parse(json) }, { onConflict: 'user_id,post_key' })
        .select('updated_at')
        .single();
      if (error) {
        console.error('[autolagring]', error.message);
        setStatus('error');
        return;
      }
      lastSaved.current = json;
      setSavedAt(data.updated_at);
      setStatus('saved');
    }

    const schedule = () => {
      if (paused.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      setStatus('pending');
      timer.current = window.setTimeout(() => void save(), DELAY_MS);
    };
    const flush = () => {
      if (document.visibilityState === 'hidden' && timer.current) {
        window.clearTimeout(timer.current);
        void save();
      }
    };
    const onSubmit = () => {
      // Lagre-knappen tar seg av resten. Kopien slettes når lagringen lykkes.
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      submitted.current = JSON.stringify(snapshot(element));
      setStatus('idle');
    };
    const onLeave = (event: BeforeUnloadEvent) => {
      if (timer.current || statusRef.current === 'saving' || statusRef.current === 'error') event.preventDefault();
    };

    element.addEventListener('input', schedule);
    element.addEventListener('change', schedule);
    element.addEventListener('submit', onSubmit);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      element.removeEventListener('input', schedule);
      element.removeEventListener('change', schedule);
      element.removeEventListener('submit', onSubmit);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('beforeunload', onLeave);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [key]);

  function restore() {
    const element = form();
    if (!element || !offer) return;
    for (const name of FIELDS) {
      if (name === 'cover_image_url') {
        window.dispatchEvent(new CustomEvent<SetMediaDetail>(SET_MEDIA_EVENT, { detail: { name, url: offer.data[name] } }));
      } else {
        setFieldValue(element, name, offer.data[name]);
      }
    }
    lastSaved.current = JSON.stringify(offer.data);
    setSavedAt(offer.savedAt);
    setStatus('saved');
    setOffer(null);
  }

  function discard() {
    setOffer(null);
    void createClient()
      .from('post_autosaves')
      .delete()
      .eq('post_key', key)
      .then(({ error }) => {
        if (error) console.error('[autolagring]', error.message);
      });
  }

  const message =
    offer ? 'Automatisk lagring venter til du har valgt over.'
    : status === 'pending' || status === 'saving' ? 'Lagrer automatisk…'
    : status === 'saved' && savedAt ? `Lagret automatisk kl. ${clock(savedAt)}. Ikke publisert før du trykker «${postId ? 'Lagre innlegget' : 'Opprett innlegget'}».`
    : status === 'error' ? 'Den automatiske lagringen virket ikke. Trykk Lagre for å være sikker.'
    : 'Det du skriver, lagres automatisk, men publiseres ikke før du trykker Lagre.';

  return (
    <div ref={root} className="pt-autosave">
      {offer && (
        <div className="pt-alert pt-autosave-offer" data-tone="warn" role="alert">
          <div>
            <strong>Du har endringer som ikke er lagret, fra {dayAndClock(offer.savedAt)}</strong>
            <p>
              De ble lagret automatisk mens du skrev, men ikke {postId ? 'lagret i innlegget' : 'opprettet som innlegg'}.
              {offer.older && ' Innlegget er lagret av noen etter dette, så det du henter inn, kan erstatte nyere endringer.'}
            </p>
            <div className="pt-actions" style={{ marginTop: '0.6rem' }}>
              <button type="button" className="pt-btn pt-btn-sm" onClick={restore}>Hent dem inn</button>
              <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" onClick={discard}>Forkast</button>
            </div>
          </div>
        </div>
      )}
      <p className="pt-hint pt-autosave-status" data-state={status} aria-live="polite">{message}</p>
    </div>
  );
}
