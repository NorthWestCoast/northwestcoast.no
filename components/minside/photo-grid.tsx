export type GridPhoto = {
  key: string;
  url: string;
  alt: string;
  /** Vises over bildet, f.eks. tidspunktet det ble tatt. */
  caption?: string | null;
  /** Vises under bildet, f.eks. en sletteknapp. */
  below?: React.ReactNode;
};

/**
 * Rutenett med private bilder (signerte lenker). Hvert bilde åpnes i full
 * størrelse i en ny fane. `large` gir større ruter, til rapporter.
 */
export default function PhotoGrid({ photos, large = false }: { photos: GridPhoto[]; large?: boolean }) {
  if (photos.length === 0) return null;

  return (
    <div
      className="pt-photos"
      style={large ? { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' } : undefined}
    >
      {photos.map((photo) => (
        <div key={photo.key}>
          <figure>
            {/* Lenken ligger inni figuren; rammen kommer fra figuren alene. */}
            <a href={photo.url} target="_blank" rel="noopener noreferrer" style={{ border: 0, borderRadius: 0 }}>
              {/* Signerte lenker fra lagringen kan ikke gå gjennom next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.alt} loading="lazy" />
            </a>
            {photo.caption && <figcaption>{photo.caption}</figcaption>}
          </figure>
          {photo.below}
        </div>
      ))}
    </div>
  );
}
