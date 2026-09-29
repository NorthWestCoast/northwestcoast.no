import Script from 'next/script';
import { GTM_ID, UMAMI_SRC, UMAMI_WEBSITE_ID } from '@/lib/analytics';

/**
 * Umami (cookiefri, GDPR-vennlig – krever ikke samtykkebanner) og/eller
 * Google Tag Manager. Begge styres av env-variabler; er ingen satt,
 * lastes ingen sporing i det hele tatt.
 */
export function AnalyticsScripts() {
  return (
    <>
      {UMAMI_WEBSITE_ID && (
        <Script
          src={UMAMI_SRC}
          data-website-id={UMAMI_WEBSITE_ID}
          strategy="afterInteractive"
          defer
        />
      )}

      {GTM_ID && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      )}
    </>
  );
}

/** GTM sin noscript-fallback. Må ligge først i <body>. */
export function AnalyticsNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
