import Script from 'next/script';
import { PLAUSIBLE_DOMAIN, PLAUSIBLE_HOST } from '@/lib/analytics';

/**
 * Laster Plausible-skriptet og setter opp window.plausible-køen slik at
 * hendelser som sendes før skriptet er ferdig lastet ikke går tapt.
 *
 * Varianten "script.tagged-events.outbound-links.js" gir oss:
 *  - tagged-events: automatisk sporing av elementer med class="plausible-event-name=..."
 *  - outbound-links: klikk ut av siden (f.eks. sosiale medier) telles automatisk
 */
export default function Analytics() {
  if (!PLAUSIBLE_DOMAIN) return null;

  return (
    <>
      <Script
        defer
        data-domain={PLAUSIBLE_DOMAIN}
        src={`${PLAUSIBLE_HOST}/js/script.tagged-events.outbound-links.js`}
        strategy="afterInteractive"
      />
      <Script id="plausible-queue" strategy="afterInteractive">
        {`window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments) }`}
      </Script>
    </>
  );
}
