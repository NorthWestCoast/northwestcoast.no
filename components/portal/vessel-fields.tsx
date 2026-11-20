'use client';

import { useEffect, useRef, useState } from 'react';
import VesselSearch from '@/components/vessel-search';
import type { VesselHit } from '@/lib/vessel-lookup';
import VesselInputs, { type VesselDefaults } from './vessel-inputs';
import { fillFields, vesselHitValues, vesselSoftFields } from './registry-fill';

/** Enter i et søkefelt skal aldri sende skjemaet det står i. */
export function keepEnterInSearch(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key === 'Enter' && (event.target as HTMLElement).getAttribute('role') === 'combobox') {
    event.preventDefault();
  }
}

/**
 * Feltene for et fartøy med søk i fartøyregisteret over. Et valgt treff
 * fyller ut feltene; alt kan rettes etterpå eller fylles ut for hånd.
 *
 * Må stå inne i et skjema (PortalForm).
 */
export default function VesselFields({ scope, vessel }: { scope: string; vessel?: VesselDefaults }) {
  const rootRef = useRef<HTMLDivElement>(null);
  /** Det søket fylte inn sist, så felt brukeren har skrevet i selv får stå. */
  const filledRef = useRef<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  // Når skjemaet tømmes etter lagring, tømmes søkefeltet også.
  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form) return;
    const onReset = () => {
      filledRef.current = {};
      setPicked(null);
      setSearchKey((key) => key + 1);
    };
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, []);

  function select(hit: VesselHit) {
    filledRef.current = fillFields(rootRef.current?.closest('form'), vesselHitValues(hit), {
      previous: filledRef.current,
      soft: vesselSoftFields(),
    });
    setPicked(hit.name);
  }

  return (
    <div ref={rootRef} className="pt-form" onKeyDown={keepEnterInSearch}>
      <VesselSearch
        key={searchKey}
        id={`${scope}-search`}
        label="Søk i fartøyregisteret"
        placeholder="Navn, kallesignal, registreringsmerke eller IMO"
        hint="Registeret har bare fiskefartøy. Andre fartøy fyller du inn selv i feltene under."
        variant="portal"
        onSelect={select}
      />
      {picked && (
        <p className="pt-hint" role="status">
          Feltene er fylt ut med opplysningene om {picked} fra fartøyregisteret. Se over dem før du lagrer.
        </p>
      )}
      <VesselInputs scope={scope} vessel={vessel} />
    </div>
  );
}
