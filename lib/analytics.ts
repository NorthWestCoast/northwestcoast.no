/**
 * Hendelsessporing mot Plausible Analytics.
 *
 * Hvorfor Plausible: europeisk leverandør (Estland, servere i EU/Tyskland),
 * cookiefri og uten personopplysninger – derfor ingen samtykkebanner, og
 * ingen dataoverføring ut av EØS. Skriptet lastes kun når
 * NEXT_PUBLIC_PLAUSIBLE_DOMAIN er satt, så lokal utvikling og previews
 * forurenser ikke statistikken.
 *
 * NEXT_PUBLIC_PLAUSIBLE_HOST kan settes til en selvhostet instans
 * (f.eks. https://analytics.northwestcoast.no) hvis dere vil eie dataene selv.
 */

export const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
export const PLAUSIBLE_HOST =
  process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? 'https://plausible.io';

/**
 * Navngitte mål. Hold listen kort og stabil – hvert navn må opprettes som
 * "goal" i Plausible for å telles i traktrapporten.
 */
export type AnalyticsEvent =
  | 'Order: Configure'      // endret lengde/antall/skap
  | 'Order: Add to cart'    // lagt en leider i bestillingen
  | 'Order: Begin checkout' // åpnet kontaktskjemaet i konfiguratoren
  | 'Order: Submitted'      // bestillingsforespørsel sendt (med verdi)
  | 'Lead: Contact form'    // kontaktskjema sendt
  | 'Lead: Newsletter'      // nyhetsbrev registrert
  | 'Lead: Phone click'     // klikk på telefonnummer
  | 'Lead: Email click'     // klikk på e-postadresse
  | 'Service: Maintenance logged' // vedlikehold registrert
  | 'CTA: Bestill'; // klikk på "Bestill nå" (settes også via tagged-events-klasser)

type PlausibleProps = Record<string, string | number | boolean>;

type PlausibleOptions = {
  props?: PlausibleProps;
  /** Omsetning knyttet til målet – gir kroneverdi per kanal i Plausible. */
  revenue?: { currency: string; amount: number };
};

declare global {
  interface Window {
    plausible?: ((event: string, options?: PlausibleOptions) => void) & {
      q?: unknown[];
    };
  }
}

/**
 * Sender en hendelse. Trygg å kalle uansett – hvis skriptet ikke er lastet
 * (blokkert, eller domenet ikke konfigurert) er dette en no-op.
 */
export function track(event: AnalyticsEvent, options?: PlausibleOptions) {
  if (typeof window === 'undefined') return;
  window.plausible?.(event, options);
}

/** Kroner er alltid heltall i rapportene – ingen ører i denne butikken. */
export function trackOrder(event: AnalyticsEvent, amountNok: number, props?: PlausibleProps) {
  track(event, {
    props,
    revenue: { currency: 'NOK', amount: Math.round(amountNok) },
  });
}
