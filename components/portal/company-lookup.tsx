'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import VesselSearch from '@/components/vessel-search';
import type { CompanyHit } from '@/lib/brreg';
import type { VesselHit } from '@/lib/vessel-lookup';
import CompanySearch from './company-search';
import { keepEnterInSearch } from './vessel-fields';
import {
  COMPANY_SOFT_FIELDS, companyHitValues, fillFields, orgNumberText, vesselHitValues, vesselSoftFields,
} from './registry-fill';

/** Selskap som alt er kunde, til kontroll mot dubletter. */
export type KnownCompany = { id: string; name: string; orgNumber: string };

type Notice = { tone: 'info' | 'warn'; title: string; text?: string; link?: { href: string; label: string } };

/**
 * Oppslag som fyller ut feltene for et selskap i skjemaet det står i:
 * søk i Brønnøysundregistrene, og – med `vesselPrefix` – «Finn kunde via
 * fartøy», der eieren av et fartøy i fartøyregisteret slås opp og fartøyet
 * fylles inn i samme skjema.
 *
 * Fyller feltene name, org_number, address, postal_code, city og
 * kontaktfeltene når registeret har dem. Alt kan rettes etterpå.
 */
export default function CompanyLookup({
  id,
  known = [],
  knownBase = '/admin/selskap/',
  selfId,
  vesselPrefix,
  label = 'Søk i Brønnøysundregistrene',
  hint = 'Velg et treff for å fylle ut feltene under. Du kan også fylle dem ut selv.',
}: {
  id: string;
  /** Kundene som finnes fra før. Uten lista gjøres ingen dublettkontroll her. */
  known?: KnownCompany[];
  /** Lenken til en kunde som finnes fra før er `knownBase` + id. */
  knownBase?: string;
  /** Selskapet som redigeres, så det ikke regnes som dublett av seg selv. */
  selfId?: string;
  /** Feltnavn-prefiks for fartøyet i samme skjema. Slår på «Finn kunde via fartøy». */
  vesselPrefix?: string;
  label?: string;
  hint?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const companyFilled = useRef<Record<string, string>>({});
  const vesselFilled = useRef<Record<string, string>>({});
  /** Teller oppslag, så et sent svar om en gammel eier ikke overskriver et nyere valg. */
  const lookupRef = useRef(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [searchKey, setSearchKey] = useState(0);

  const form = () => rootRef.current?.closest('form') ?? null;

  // Når skjemaet tømmes etter lagring, tømmes søkefeltene og meldingene også.
  useEffect(() => {
    const element = rootRef.current?.closest('form');
    if (!element) return;
    const onReset = () => {
      lookupRef.current += 1;
      companyFilled.current = {};
      vesselFilled.current = {};
      setNotices([]);
      setSearchKey((key) => key + 1);
    };
    element.addEventListener('reset', onReset);
    return () => element.removeEventListener('reset', onReset);
  }, []);

  /** Meldingen som vises i stedet for å fylle ut, når selskapet alt er kunde. */
  function knownNotice(orgNumber: string, viaVessel: boolean): Notice | null {
    const duplicate = known.find((company) => company.orgNumber === orgNumber && company.id !== selfId);
    if (!duplicate) return null;
    return {
      tone: 'warn',
      title: `${duplicate.name} er allerede kunde`,
      text: viaVessel
        ? `Org.nr. ${orgNumberText(orgNumber)} er registrert fra før. Åpne kunden og legg til fartøyet der, så blir det ingen dublett.`
        : `Org.nr. ${orgNumberText(orgNumber)} er registrert fra før. Åpne kunden i stedet for å opprette den på nytt.`,
      link: { href: `${knownBase}${duplicate.id}`, label: `Åpne ${duplicate.name}` },
    };
  }

  /** Fyller ut selskapet og returnerer advarslene som hører til. */
  function applyCompany(hit: CompanyHit): Notice[] {
    companyFilled.current = fillFields(form(), companyHitValues(hit), {
      previous: companyFilled.current,
      soft: COMPANY_SOFT_FIELDS,
    });
    return hit.inactive
      ? [{
          tone: 'warn',
          title: `${hit.name} er konkurs, under avvikling eller slettet`,
          text: 'Det står i Brønnøysundregistrene. Kontroller at dette er riktig selskap før du lagrer.',
        }]
      : [];
  }

  function selectCompany(hit: CompanyHit) {
    lookupRef.current += 1;
    const duplicate = knownNotice(hit.orgNumber, false);
    setNotices(duplicate ? [duplicate] : applyCompany(hit));
  }

  async function selectVessel(hit: VesselHit) {
    if (vesselPrefix === undefined) return;
    const lookup = (lookupRef.current += 1);

    // Eieren er alt kunde: fartøyet skal legges til der, ikke i dette skjemaet.
    const duplicate = hit.owner?.orgNumber ? knownNotice(hit.owner.orgNumber, true) : null;
    if (duplicate) {
      const cleared = Object.fromEntries(Object.keys(vesselHitValues(hit, vesselPrefix)).map((name) => [name, null]));
      fillFields(form(), cleared, { previous: vesselFilled.current, soft: vesselSoftFields(vesselPrefix) });
      vesselFilled.current = {};
      setNotices([duplicate]);
      return;
    }

    vesselFilled.current = fillFields(form(), vesselHitValues(hit, vesselPrefix), {
      previous: vesselFilled.current,
      soft: vesselSoftFields(vesselPrefix),
    });
    // Fartøyfeltene kan ligge i en sammenslått del av skjemaet.
    const nameField = form()?.elements.namedItem(`${vesselPrefix}name`);
    if (nameField instanceof HTMLElement) nameField.closest('details')?.setAttribute('open', '');

    const vesselNotice: Notice = {
      tone: 'info',
      title: `${hit.name} er lagt inn som fartøy`,
      text: 'Fartøyet opprettes sammen med kunden. Se over opplysningene under før du lagrer.',
    };

    const owner = hit.owner;
    if (!owner) {
      setNotices([vesselNotice, {
        tone: 'warn',
        title: 'Fartøyet står uten eier i registeret',
        text: 'Fyll inn kunden selv, eller søk i Brønnøysundregistrene.',
      }]);
      return;
    }

    /** Det fartøyregisteret selv vet om eieren, når Brønnøysund ikke gir mer. */
    const fromRegistry = () => {
      companyFilled.current = fillFields(
        form(),
        { name: owner.name, org_number: owner.orgNumber, postal_code: owner.postalCode, city: owner.city, address: null },
        { previous: companyFilled.current },
      );
    };

    if (!owner.orgNumber) {
      fromRegistry();
      setNotices([vesselNotice, {
        tone: 'info',
        title: `Eier: ${owner.name}`,
        text: 'Eieren står uten organisasjonsnummer i fartøyregisteret (privatperson eller utenlandsk eier). Navn og sted er fylt ut. Resten legger du inn selv.',
      }]);
      return;
    }

    let company: CompanyHit | null = null;
    let failed = false;
    try {
      const res = await fetch(`/api/brreg?q=${owner.orgNumber}`, { headers: { Accept: 'application/json' } });
      const body = (await res.json()) as { status?: string; results?: CompanyHit[] };
      if (res.ok && body.status === 'ok' && Array.isArray(body.results)) company = body.results[0] ?? null;
      else failed = true;
    } catch {
      failed = true;
    }
    // Brukeren har valgt noe annet mens oppslaget pågikk.
    if (lookup !== lookupRef.current) return;

    if (company) {
      setNotices([
        vesselNotice,
        { tone: 'info', title: `Eier: ${company.name}`, text: 'Kunden er fylt ut fra Brønnøysundregistrene.' },
        ...applyCompany(company),
      ]);
      return;
    }

    fromRegistry();
    setNotices([vesselNotice, {
      tone: 'warn',
      title: `Eier: ${owner.name}`,
      text: failed
        ? 'Brønnøysundregistrene svarer ikke akkurat nå. Navn, org.nr. og sted er hentet fra fartøyregisteret. Adressen legger du inn selv.'
        : 'Fant ikke eieren i Brønnøysundregistrene. Navn, org.nr. og sted er hentet fra fartøyregisteret.',
    }]);
  }

  const companySearch = (
    <CompanySearch
      key={`company-${searchKey}`}
      id={id}
      label={label}
      placeholder="Navn eller organisasjonsnummer"
      hint={hint}
      onSelect={selectCompany}
    />
  );

  return (
    <div ref={rootRef} className="pt-form" onKeyDown={keepEnterInSearch}>
      {vesselPrefix === undefined ? companySearch : (
        <div className="pt-form-row">
          {companySearch}
          <VesselSearch
            key={`vessel-${searchKey}`}
            id={`${id}-vessel`}
            label="Finn kunde via fartøy"
            placeholder="Fartøynavn, kallesignal, merke eller IMO"
            hint="Søker i fartøyregisteret, som bare har fiskefartøy. Eieren slås opp, og fartøyet legges inn sammen med kunden."
            variant="portal"
            onSelect={selectVessel}
          />
        </div>
      )}

      {notices.map((notice) => (
        <div key={notice.title} className="pt-alert" data-tone={notice.tone} role="status" style={{ marginBottom: 0 }}>
          <div>
            <strong>{notice.title}</strong>
            {notice.text && <p>{notice.text}</p>}
            {notice.link && (
              <p><Link href={notice.link.href} className="pt-link">{notice.link.label}</Link></p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
