/**
 * Skriver ut Schema.org-data. Innholdet er vårt eget, statiske innhold –
 * ingen brukerinput – så JSON.stringify er trygt her. `<` escapes likevel
 * for å hindre at en fremtidig streng kan lukke script-taggen.
 *
 * En liste skrives som én script-tagg per objekt, aldri som en JSON-liste.
 * Safari leser selv JSON-LD på siden og forventer et objekt med `@context`
 * på toppnivå; får den en liste, kaster den «undefined is not an object
 * (evaluating 'r["@context"].toLowerCase')» (WebKit-feil 255764).
 */
export default function JsonLd({ data }: { data: object | object[] }) {
  const blocks = Array.isArray(data) ? data : [data];

  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(block).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  );
}
