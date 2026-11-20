'use client';

import { useEffect, useRef, useState } from 'react';
import type { CompanyHit } from '@/lib/brreg';
import { orgNumberText } from './registry-fill';

/**
 * Søkefelt for selskap (combobox) mot GET /api/brreg, som slår opp i
 * Enhetsregisteret på navn eller organisasjonsnummer.
 *
 * Tvillingen til components/vessel-search.tsx: samme oppførsel, samme
 * tastatur og de samme klassene (pt-combo… i app/(portal)/portal.css), så de
 * to feltene ser like ut når de står ved siden av hverandre.
 *
 * Feltet er bare en snarvei. Det fyller ingenting ut selv – den som bruker det
 * får treffet i onSelect og bestemmer hva som skal skje.
 */

type Props = {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Ekstra klasse på ytterste element, f.eks. for plassering i et rutenett. */
  className?: string;
  onSelect: (hit: CompanyHit) => void;
};

type Status = 'idle' | 'loading' | 'ok' | 'empty' | 'unavailable';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

const TEXTS = {
  loading: 'Søker …',
  empty: 'Fant ingen selskap. Fyll inn opplysningene selv.',
  unavailable: 'Brønnøysundregistrene svarer ikke akkurat nå. Fyll inn opplysningene selv.',
  count: '{n} treff. Velg med piltastene og Enter.',
  inactive: 'Konkurs, under avvikling eller slettet',
};

export default function CompanySearch({ id, label, placeholder, hint, className, onSelect }: Props) {
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CompanyHit[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Navnet på selskapet som sist ble valgt, så valget ikke utløser et nytt søk. */
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
        const res = await fetch(`/api/brreg?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const body = (await res.json()) as { status?: string; results?: CompanyHit[] };
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
      ? TEXTS.empty
      : status === 'unavailable'
        ? TEXTS.unavailable
        : status === 'loading' && results.length === 0
          ? TEXTS.loading
          : '';
  const announcement = status === 'ok' ? TEXTS.count.replace('{n}', String(results.length)) : message;

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

  function choose(hit: CompanyHit) {
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
        // Mens lista er åpen skal Enter aldri sende skjemaet rundt feltet.
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
      className={['pt-field', 'pt-combo', className].filter(Boolean).join(' ')}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>

      <div className="pt-combo-box">
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

        <div className="pt-combo-pop" hidden={!open || (!expanded && !message)}>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-busy={status === 'loading'}
            className="pt-combo-list"
            hidden={!expanded}
          >
            {results.map((hit, index) => {
              const place = [hit.address, [hit.postalCode, hit.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
              const meta = [hit.orgForm, place, hit.inactive ? TEXTS.inactive : null].filter(Boolean).join(' · ');
              return (
                <li
                  key={hit.orgNumber}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className="pt-combo-option"
                  // Hindrer at feltet mister fokus før klikket er registrert.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(hit)}
                >
                  <span className="pt-combo-name">{hit.name}</span>
                  <span className="pt-combo-size">{orgNumberText(hit.orgNumber)}</span>
                  {meta && <span className="pt-combo-meta">{meta}</span>}
                </li>
              );
            })}
          </ul>
          {message && <p className="pt-combo-msg">{message}</p>}
        </div>
      </div>

      {hint && (
        <p id={hintId} className="pt-combo-hint">
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
