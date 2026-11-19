/**
 * Klientside bildebehandling før opplasting.
 *
 * Hvorfor dette finnes: bildene lastes opp direkte fra nettleseren til
 * Supabase Storage. De skal aldri gjennom vår egen server – et 5 MB bilde
 * blir 6,7 MB som base64 i en JSON-body, og Vercel avviser alt over 4,5 MB.
 * I tillegg fotograferer mannskap ofte med dårlig dekning om bord, så færre
 * megabyte er forskjellen på en rapport som kommer fram og en som ikke gjør det.
 */

export type PreparedImage = {
  file: File;
  /** Når bildet ble TATT, ikke lastet opp. Null når det ikke lar seg lese. */
  capturedAt: string | null;
  originalBytes: number;
  bytes: number;
};

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
/** Under denne størrelsen er komprimering ikke verdt tapet i kvalitet. */
const SKIP_COMPRESSION_UNDER = 300 * 1024;

/**
 * Leser DateTimeOriginal fra EXIF.
 *
 * captured_at ≠ uploaded_at: mannskap tar bildet kl. 14 og laster opp kl. 22
 * når de får dekning. For los-delingen er det tidspunktet bildet ble tatt som
 * avgjør om informasjonen er fersk, så vi gjetter ikke – finner vi ingen
 * EXIF-dato, lar vi feltet stå tomt heller enn å påstå noe galt.
 */
export async function readCapturedAt(file: File): Promise<string | null> {
  try {
    // EXIF ligger tidlig i filen; 128 kB holder med god margin.
    const head = await file.slice(0, 131072).arrayBuffer();
    const view = new DataView(head);

    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // ikke JPEG

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;

      const marker = view.getUint8(offset + 1);
      const segmentLength = view.getUint16(offset + 2);

      // APP1 = 0xE1, der EXIF bor.
      if (marker === 0xe1) {
        const exifStart = offset + 4;
        // Signaturen "Exif\0\0"
        if (
          view.getUint32(exifStart) !== 0x45786966 ||
          view.getUint16(exifStart + 4) !== 0x0000
        ) {
          return null;
        }
        return readExifDate(view, exifStart + 6);
      }

      offset += 2 + segmentLength;
    }
    return null;
  } catch {
    return null;
  }
}

function readExifDate(view: DataView, tiffStart: number): string | null {
  if (tiffStart + 8 > view.byteLength) return null;

  // TIFF-header: "II" (little endian) eller "MM" (big endian).
  const endian = view.getUint16(tiffStart);
  const little = endian === 0x4949;
  if (!little && endian !== 0x4d4d) return null;

  const ifdOffset = view.getUint32(tiffStart + 4, little);
  const exifIfd = findTag(view, tiffStart, tiffStart + ifdOffset, 0x8769, little);
  if (exifIfd === null) return null;

  // 0x9003 = DateTimeOriginal, formatert "YYYY:MM:DD HH:MM:SS"
  const dateOffset = findTag(view, tiffStart, tiffStart + exifIfd, 0x9003, little);
  if (dateOffset === null) return null;

  let raw = '';
  for (let i = 0; i < 19 && tiffStart + dateOffset + i < view.byteLength; i += 1) {
    raw += String.fromCharCode(view.getUint8(tiffStart + dateOffset + i));
  }

  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;
  // EXIF har ingen tidssone. Vi tolker den som lokal tid på enheten, som er
  // der bildet faktisk ble tatt.
  const parsed = new Date(
    Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Leser verdifeltet til en tag i en IFD.
 *
 * For LONG med count 1 (ExifIFDPointer) er feltet selve verdien; for ASCII
 * lengre enn 4 byte (DateTimeOriginal) er det en offset. Begge leses likt.
 */
function findTag(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  tag: number,
  little: boolean,
): number | null {
  if (ifdStart + 2 > view.byteLength) return null;

  const entries = view.getUint16(ifdStart, little);
  for (let i = 0; i < entries; i += 1) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;

    if (view.getUint16(entry, little) === tag) {
      return view.getUint32(entry + 8, little);
    }
  }
  return null;
}

/**
 * Skalerer ned og komprimerer til JPEG.
 *
 * imageOrientation: 'from-image' er viktig – uten den havner bilder tatt i
 * portrettmodus på siden, fordi EXIF-rotasjonen forsvinner når vi tegner
 * til canvas.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size < SKIP_COMPRESSION_UNDER) return file;
  if (typeof createImageBitmap !== 'function') return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    // Klarer vi ikke å komprimere, last opp originalen heller enn å feile.
    return file;
  }
}

/** Leser EXIF-dato og komprimerer i én operasjon. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  // EXIF må leses FØR komprimering – canvas beholder ikke metadata.
  const capturedAt = await readCapturedAt(file);
  const compressed = await compressImage(file);
  return {
    file: compressed,
    capturedAt,
    originalBytes: file.size,
    bytes: compressed.size,
  };
}
