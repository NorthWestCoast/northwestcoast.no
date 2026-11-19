'use client';

import { useEffect, useRef, useState } from 'react';
import type { VesselHit } from '@/lib/vessel-lookup';

/**
 * Søkefelt for fartøy (combobox) mot GET /api/vessels.
 *
 * Brukes både på den mørke nettsiden (variant="site", klasser calc-combo… i
 * app/globals.css) og i den lyse portalen (variant="portal", klasser pt-combo…
 * i app/(portal)/portal.css). Komponenten kjenner ikke ordbøkene: tekstene tas
 * som prop og har norske standardverdier.
 *
 * Feltet er bare en snarvei. Det fyller ingenting ut selv – den som bruker det
 * får treffet i onSelect og bestemmer hva som skal skje.
 */

export type VesselSearchTexts = {
  /** Vises mens registeret spørres. */
  loading: string;
  /** Ingen treff. Registeret har bare fiskefartøy, og det må teksten si. */
  empty: string;
  /** Registeret svarte ikke (nedetid, tidsavbrudd, for mange forespørsler). */
  unavailable: string;
  /** Leses opp av skjermlesere når treffene er klare. «{n}» byttes med antallet. */
  count: string;
  /** Ledetekst foran eieren i trefflista. */
  owner: string;
};

export const VESSEL_SEARCH_TEXTS: VesselSearchTexts = {
  loading: 'Søker …',
  empty: 'Fant ingen fartøy. Registeret har bare fiskefartøy – fyll inn opplysningene selv.',
  unavailable: 'Fartøyregisteret svarer ikke akkurat nå. Fyll inn opplysningene selv.',
  count: '{n} treff. Velg med piltastene og Enter.',
  owner: 'Eier',
};

type Props = {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Velger klasseprefiks: «site» for nettsiden, «portal» for portalen. */
  variant: 'site' | 'portal';
  texts?: Partial<VesselSearchTexts>;
  /** Tallformat i trefflista. */
  locale?: string;
  /** Ekstra klasse på ytterste element, f.eks. for plassering i et rutenett. */
  className?: string;
  onSelect: (hit: VesselHit) => void;
};

type Status = 'idle' | 'loading' | 'ok' | 'empty' | 'unavailable';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

function sizeOf(hit: VesselHit, locale: string): string {
  const n = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  if (hit.length && hit.width) return `${n(hit.length)} × ${n(hit.width)} m`;
  if (hit.length) return `${n(hit.length)} m`;
  return '';
}

export default function VesselSearch({
  id,
  label,
  placeholder,
  hint,
  variant,
  texts,
  locale = 'nb-NO',
  className,
  onSelect,
}: Props) {
  const t = { ...VESSEL_SEARCH_TEXTS, ...texts };
  const p = variant === 'portal' ? 'pt-combo' : 'calc-combo';
  const field = variant === 'portal' ? 'pt-field' : 'calc-field';

  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VesselHit[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Navnet på fartøyet som sist ble valgt, så valget ikke utløser et nytt søk. */
  const pickedRef = useRef<string | null>(null);

  // Søk med forsinkelse. En ny tast avbryter både ventetiden og en forespørsel
  // som allerede er sendt, så et gammelt svar aldri kan overskrive et nytt.
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_CHARS || term === pickedRef.current) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(`/api/vessels?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const body = (await res.json()) as { status?: string; results?: VesselHit[] };
        if (controller.signal.aborted) return;

        if (!res.ok || body.status !== 'ok' || !Array.isArray(body.results)) {
          setResults([]);
          setActive(-1);
          setStatus('unavailable');
          return;
        }
        setResults(body.results);
        // Første treff er markert, så Enter velger det beste treffet direkte.
        setActive(body.results.length > 0 ? 0 : -1);
        setStatus(body.results.length > 0 ? 'ok' : 'empty');
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setActive(-1);
        setStatus('unavailable');
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Klikk utenfor lukker lista.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Hold det markerte treffet synlig når lista ruller. Bare lista flyttes,
  // aldri selve siden.
  useEffect(() => {
    const list = listRef.current;
    const option = list?.children[active] as HTMLElement | undefined;
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop;
    } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [active]);

  const expanded = open && results.length > 0;
  const message =
    status === 'empty'
      ? t.empty
      : status === 'unavailable'
        ? t.unavailable
        : status === 'loading' && results.length === 0
          ? t.loading
          : '';
  const announcement = status === 'ok' ? t.count.replace('{n}', String(results.length)) : message;

  function reset() {
    setResults([]);
    setStatus('idle');
    setActive(-1);
    setOpen(false);
  }

  function handleChange(value: string) {
    pickedRef.current = null;
    setQuery(value);
    if (value.trim().length < MIN_CHARS) reset();
    else setOpen(true);
  }

  function choose(hit: VesselHit) {
    pickedRef.current = hit.name;
    setQuery(hit.name);
    reset();
    onSelect(hit);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    const count = results.length;

    switch (event.key) {
      case 'ArrowDown':
        if (count === 0) return;
        event.preventDefault();
        if (!expanded) {
          setOpen(true);
          setActive((current) => (current < 0 ? 0 : current));
        } else {
          setActive((current) => (current + 1) % count);
        }
        break;
      case 'ArrowUp':
        if (count === 0) return;
        event.preventDefault();
        if (!expanded) {
          setOpen(true);
          setActive(count - 1);
        } else {
          setActive((current) => (current <= 0 ? count : current) - 1);
        }
        break;
      case 'Enter':
        // Mens lista er åpen skal Enter aldri sende et skjema rundt feltet.
        if (!open) return;
        event.preventDefault();
        if (expanded && results[active]) choose(results[active]);
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        } else if (query) {
          event.preventDefault();
          pickedRef.current = null;
          setQuery('');
          reset();
        }
        break;
    }
  }

  return (
    <div
      ref={rootRef}
      className={[field, p, className].filter(Boolean).join(' ')}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>

      <div className={`${p}-box`}>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          aria-describedby={hint ? hintId : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (status !== 'idle') setOpen(true);
          }}
        />

        <div className={`${p}-pop`} hidden={!open || (!expanded && !message)}>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-busy={status === 'loading'}
            className={`${p}-list`}
            hidden={!expanded}
          >
            {results.map((hit, index) => {
              const size = sizeOf(hit, locale);
              const marks = [hit.registrationMark, hit.callSign, hit.imo ? `IMO ${hit.imo}` : null].filter(Boolean);
              const owner = hit.owner ? [hit.owner.name, hit.owner.city].filter(Boolean).join(', ') : '';
              return (
                <li
                  key={hit.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={`${p}-option`}
                  // Hindrer at feltet mister fokus før klikket er registrert.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(hit)}
                >
                  <span className={`${p}-name`}>{hit.name}</span>
                  {size && <span className={`${p}-size`}>{size}</span>}
                  {(marks.length > 0 || owner) && (
                    <span className={`${p}-meta`}>
                      {marks.join(' · ')}
                      {marks.length > 0 && owner ? ' · ' : ''}
                      {owner && `${t.owner}: ${owner}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {message && <p className={`${p}-msg`}>{message}</p>}
        </div>
      </div>

      {hint && (
        <p id={hintId} className={`${p}-hint`}>
          {hint}
        </p>
      )}

      {/* Skjermlesere får beskjed om antall treff, tomt søk og feil. */}
      <p className="sr-only" role="status">
        {open ? announcement : ''}
      </p>
    </div>
  );
}
