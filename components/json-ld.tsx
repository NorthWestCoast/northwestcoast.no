/**
 * Renders a JSON-LD block.
 *
 * Server-rendered on purpose: crawlers that do not execute JavaScript (and most
 * AI crawlers do not) still see the structured data in the raw HTML.
 *
 * The `<` escape guards against a stray "</script>" inside any string value
 * closing the script tag early — the standard XSS hole in hand-rolled JSON-LD.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
