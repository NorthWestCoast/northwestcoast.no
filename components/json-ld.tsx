/**
 * Skriver ut Schema.org-data. Innholdet er vårt eget, statiske innhold –
 * ingen brukerinput – så JSON.stringify er trygt her. `<` escapes likevel
 * for å hindre at en fremtidig streng kan lukke script-taggen.
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
