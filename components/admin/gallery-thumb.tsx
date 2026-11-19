import Image from 'next/image';

/**
 * Et galleribilde i admin: lite i lista, større på siden for ett bilde.
 * Bilder med gjennomsiktig bakgrunn vises i sin helhet på sandfarget bunn,
 * slik de vises på nettsiden.
 */
export default function GalleryThumb({
  src,
  alt,
  contain,
  unoptimized,
  large = false,
}: {
  src: string;
  alt: string;
  contain: boolean;
  unoptimized: boolean;
  large?: boolean;
}) {
  return (
    <span className={large ? 'pt-thumb pt-thumb-lg' : 'pt-thumb'} data-contain={contain}>
      <Image
        src={src}
        alt={alt}
        width={large ? 640 : 224}
        height={large ? 480 : 168}
        sizes={large ? '(max-width: 640px) 100vw, 420px' : '112px'}
        unoptimized={unoptimized}
      />
    </span>
  );
}
