/**
 * Lager favikon og app-ikoner fra NWC-merket.
 *
 *   node scripts/generate-icons.mjs
 *
 * Skriver:
 *   app/favicon.ico                     16, 24, 32 og 48 px (fanene i nettleseren)
 *   app/icon.png                        96 px (søkeresultater, bokmerker)
 *   app/apple-icon.png                  180 px (hjem-skjerm på iPhone/iPad)
 *   public/icons/icon-192.png           manifestet
 *   public/icons/icon-512.png           manifestet og logo i strukturerte data
 *   public/icons/icon-maskable-512.png  Android, som beskjærer til sirkel o.l.
 *   public/icons/nwc-mark.svg           merket som vektor (originalen til alt over)
 *
 * Merket er tegnet som vektor etter den kvadratiske logoen
 * (public/images/logo/logo.png): «NWC» i hvitt på marineblå bunn, en hvit bue
 * og en mørkerød bølge. Bokstavene er kurver, ikke tekst, så de ser like ut
 * overalt. De er hentet fra selskapets eget ordmerke med
 * scripts/trace-logo-letters.mjs.
 *
 * Utgaver: den store følger logoen. Den lille (under 100 px) har litt større
 * og kraftigere bokstaver og en tykkere bue, ellers forsvinner de tynne
 * strekene. I 16 px er bokstavene lagt rett på pikselrutenettet.
 *
 * Hvorfor ikke app/icon.svg: nettlesere som støtter SVG-ikon velger det foran
 * favicon.ico i alle størrelser, også 16 px, og der blir de ekte
 * bokstavformene fire piksler høye og grøtete. Med ferdige punktbilder
 * styrer vi hva som vises i hver størrelse.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Fargene er målt i logoen.
const NAVY = '#1f2c58';
const RED = '#841b20';
const WHITE = '#ffffff';

// Versalhøyde 100. Kilde: public/images/logo/NY-logo.png (scripts/trace-logo-letters.mjs).
const LETTERS = {
  N: {
    d: 'M10.13 0L9.6 0.37L10.85 10.83C11.05 12.54 11.06 14.33 11.06 16.05L10.98 89.22C10.98 92.65 7.34 95.93 4.19 96.54C2.9 96.79 1.61 96.52 0.33 96.69L0 97.06L0 97.71L0.33 98.04L36.91 98.04L37.24 97.71L37.24 97.06L36.91 96.69C35.63 96.52 34.32 96.82 33.03 96.56C29.89 95.93 26.23 92.63 26.23 89.22L26.13 31.08L26.18 30.42L26.46 30.1L97.02 99.67L97.67 100L98.32 99.89L98.54 99.67L97.44 91.83C97.11 89.48 97.01 86.86 97.01 84.49L97.01 11.64C97.01 7.91 100.11 4.37 103.68 3.56C104.94 3.27 106.2 3.52 107.47 3.36L107.9 2.99L107.9 2.33L107.47 2.01L71.54 2.01L71.01 2.33L71.01 2.99L71.54 3.36C72.8 3.52 74.09 3.25 75.36 3.52C78.41 4.18 82.02 7.7 82.02 10.99L81.99 69.81L81.34 69.62L81.33 69.62L66.66 55.22L11.3 0.37L10.78 0.03L10.13 0Z',
    width: 107.9,
  },
  W: {
    d: 'M75 -0.15L74.56 0.37L74.37 0.76C73.81 1.91 73.36 3.21 72.9 4.41L50.28 63.6L50.17 63.84L49.89 64.4L49.52 65.05L34.3 20.59L31.69 12.75L31.57 12.13L31.47 11.48C31.35 10.82 31.04 10.2 31 9.52C30.86 7.24 31.81 5.14 33.94 4.07C35.38 3.35 36.93 3.62 37.76 3.25L37.98 2.99L37.98 2.33L37.76 2.12L37.11 2.01L0.52 2.01L0 2.33L0 2.99L0.52 3.36C1.02 3.56 1.93 3.36 2.48 3.45C3.32 3.59 4.22 3.84 5.02 4.12C8.59 5.38 11.7 8.01 13.01 11.64L42.8 93.71C43.48 95.6 44.06 97.74 44.95 99.54L45.02 99.67L45.6 100.19L46.25 100.08L46.5 99.67C46.76 98.92 46.56 97.85 46.65 97.06C46.82 95.62 46.97 93.9 47.4 92.53L50.04 84.12L69.64 33.81C70.05 32.75 70.6 31.74 71.08 30.71L71.35 31.08L71.73 31.73L71.81 31.89L99.75 98.86C100.47 100.59 100.65 99.73 101.13 100.19L101.56 99.67C101.67 99.05 101.55 98.35 101.61 97.71C101.75 96.04 101.87 94.15 102.28 92.53L104.26 84.74L127.76 10.29C128.84 6.86 133.52 4.35 136.79 3.65C137.47 3.51 139.27 3.52 139.67 3.36L140.19 2.99L140.19 2.33L139.67 2.01L112.89 2.01L112.24 2.05L111.96 2.33L111.96 2.99L112.24 3.31C112.94 3.61 113.98 3.3 114.74 3.52C117.36 4.27 119.63 7.28 118.84 10.09L104.53 61.03C104.22 62.16 103.88 63.3 103.47 64.4L103.09 64.91L76.45 1.14C75.68 -0.72 75.4 0.2 75 -0.15Z',
    width: 140.19,
  },
  C: {
    d: 'M92.92 59.39L92.07 59.75C91.44 61.48 91.41 63.32 91.05 65.12C89.59 72.38 86.79 80.08 81.92 85.78C72.02 97.36 52.81 99.6 39.45 93.29C35.12 91.24 31.39 87.79 28.39 84.1C22.78 77.2 20.24 68.43 19.17 59.75C16.15 35.1 25.2 6.57 54.28 5.63C61.47 5.4 68.72 7.02 74.81 10.87C80.13 14.24 84.11 18.78 86.61 24.6C87.39 26.43 87.69 28.69 88.63 30.41L89.35 30.77L89.7 30.89L89.82 30.77L90.06 29.7C90.14 25.43 89.43 21.08 89.26 16.82C89.17 14.34 89.35 11.76 89.09 9.3L88.63 8.59C68.88 -2.46 39.99 -3.01 20.67 9.42C6.27 18.67 -0.02 34.56 0 51.16C0.01 63.49 3.26 75.4 11.43 84.87C25.41 101.06 52.95 105.85 72.58 99.14C80.17 96.54 86.47 91.98 91.33 85.61L91.84 84.97L92.34 84.3L92.76 83.63L93.05 83.09C93.71 81.19 93.51 62.76 93.28 59.75L92.92 59.39Z',
    width: 93.49,
  },
};

/**
 * Utgavene av merket. Alle mål er andeler av ikonets side (0–1), bortsett fra
 * `gaps` og `bold`, som er i bokstavenes egne enheter (versalhøyde = 100).
 *
 *   cap       versalhøyde
 *   baseline  grunnlinjas plass fra toppen
 *   gaps      luft mellom N–W og W–C
 *   bold      ekstra strektykkelse rundt bokstavene
 *   upper     buens overkant (kubisk bézier fra venstre til høyre kant)
 *   lower     skillet mellom den hvite buen og den røde bølgen
 */
const VARIANTS = {
  // Følger logoen: bokstavene midt på, buen like under.
  full: {
    cap: 0.2356,
    baseline: 0.6222,
    gaps: [13, 7.5],
    bold: 0,
    upper: [[0, 0.8858], [0.29, 0.6994], [0.6569, 0.5869], [1, 0.6804]],
    lower: [[0.1227, 1], [0.3751, 0.8138], [0.6811, 0.682], [1, 0.6973]],
  },
  // Android og andre som beskjærer ikonet: alt viktig innenfor en sirkel
  // med 40 % radius. Bokstavene er derfor mindre, buen går fortsatt helt ut.
  maskable: {
    cap: 0.2,
    baseline: 0.598,
    gaps: [13, 7.5],
    bold: 0,
    upper: [[0, 0.8858], [0.29, 0.6994], [0.6569, 0.5869], [1, 0.6804]],
    lower: [[0.1227, 1], [0.3751, 0.8138], [0.6811, 0.682], [1, 0.6973]],
  },
  // Faner og søkeresultater: større og kraftigere bokstaver, tykkere bue.
  // Bokstavene holder seg innenfor en innskrevet sirkel, siden Google viser
  // ikonet rundt i søkeresultatene på mobil.
  small: {
    cap: 0.255,
    baseline: 0.595,
    gaps: [8, 4],
    bold: 5,
    upper: [[0, 0.9], [0.29, 0.735], [0.6569, 0.64], [1, 0.715]],
    lower: [[0.2, 1], [0.44, 0.86], [0.72, 0.775], [1, 0.79]],
  },
};
// 16 px: samme bue som den lille utgaven, bokstavene fra PIXEL_16.
VARIANTS.pixel16 = { ...VARIANTS.small, upper: [[0, 0.93], [0.29, 0.78], [0.6569, 0.675], [1, 0.74]], lower: [[0.22, 1], [0.46, 0.89], [0.72, 0.81], [1, 0.82]] };

/**
 * 16 px: bokstavene tegnes rett på pikselrutenettet. Skalert ned blir de
 * ekte bokstavformene fire piksler høye og uleselige; her får hver strek en
 * hel piksel. Brukes bare i 16 px-bildet i favicon.ico (skjermer uten
 * høy oppløsning). Større bilder har de ekte bokstavene.
 */
const PIXEL_16 = {
  top: 3,
  letters: [
    { left: 1, rows: ['#..#', '##.#', '##.#', '#.##', '#.##', '#..#'] },
    { left: 6, rows: ['#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'] },
    { left: 12, rows: ['.##', '#..', '#..', '#..', '#..', '.##'] },
  ],
};

const n = (value) => +value.toFixed(3);

/** Merket som SVG. `size` er sidelengden i piksler. */
function markSvg(size, variant) {
  const v = VARIANTS[variant];
  const s = (value) => n(value * size);
  const point = ([x, y]) => `${s(x)} ${s(y)}`;
  const curve = (c) => `C${point(c[1])} ${point(c[2])} ${point(c[3])}`;

  // Hvitt fra buens overkant og ned, rødt oppå. Da blir det ingen blå søm
  // mellom hvitt og rødt når kantene jevnes ut.
  const white = `M${point(v.upper[0])}${curve(v.upper)}V${size}H0Z`;
  const red = `M${point(v.lower[0])}${curve(v.lower)}V${size}Z`;

  const scale = (v.cap * size) / 100;
  const total = LETTERS.N.width + LETTERS.W.width + LETTERS.C.width + v.gaps[0] + v.gaps[1];
  const left = (size - total * scale) / 2;
  const top = v.baseline * size - 100 * scale;
  const offsets = {
    N: 0,
    W: LETTERS.N.width + v.gaps[0],
    C: LETTERS.N.width + v.gaps[0] + LETTERS.W.width + v.gaps[1],
  };
  const stroke = v.bold
    ? ` stroke="${WHITE}" stroke-width="${v.bold}" stroke-linejoin="round"`
    : '';
  const letters = ['N', 'W', 'C']
    .map((k) => `<path transform="translate(${n(offsets[k])})" d="${LETTERS[k].d}"/>`)
    .join('');

  let text = `<g transform="translate(${n(left)} ${n(top)}) scale(${n(scale)})" fill="${WHITE}"${stroke}>${letters}</g>`;
  if (variant === 'pixel16') {
    const cells = PIXEL_16.letters.flatMap(({ left: x0, rows }) =>
      rows.flatMap((row, y) =>
        [...row].flatMap((cell, x) => (cell === '#' ? [`M${x0 + x} ${PIXEL_16.top + y}h1v1h-1z`] : [])),
      ),
    );
    text = `<path d="${cells.join('')}" fill="${WHITE}" shape-rendering="crispEdges"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<title>NorthWest Coast</title>` +
    `<rect width="${size}" height="${size}" fill="${NAVY}"/>` +
    `<path d="${white}" fill="${WHITE}"/>` +
    `<path d="${red}" fill="${RED}"/>` +
    text +
    `</svg>`
  );
}

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

/**
 * ICO med 32-biters punktgrafikk (BGRA + maske). PNG inni ICO går også i dagens
 * nettlesere, men dette formatet leses av alt.
 */
async function ico(entries) {
  const images = await Promise.all(
    entries.map(async ({ size, svg }) => {
      const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const header = Buffer.alloc(40);
      header.writeUInt32LE(40, 0);
      header.writeInt32LE(size, 4);
      header.writeInt32LE(size * 2, 8); // bildet + masken
      header.writeUInt16LE(1, 12);
      header.writeUInt16LE(32, 14);
      header.writeUInt32LE(size * size * 4, 20);
      const pixels = Buffer.alloc(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const from = (y * size + x) * 4;
          const to = ((size - 1 - y) * size + x) * 4; // nederste rad først
          pixels[to] = data[from + 2];
          pixels[to + 1] = data[from + 1];
          pixels[to + 2] = data[from];
          pixels[to + 3] = data[from + 3];
        }
      }
      const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size); // alt synlig
      return { size, bytes: Buffer.concat([header, pixels, mask]) };
    }),
  );

  const dir = Buffer.alloc(6 + images.length * 16);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(images.length, 4);
  let offset = dir.length;
  images.forEach(({ size, bytes }, i) => {
    const at = 6 + i * 16;
    dir.writeUInt8(size, at);
    dir.writeUInt8(size, at + 1);
    dir.writeUInt16LE(1, at + 4);
    dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(bytes.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += bytes.length;
  });
  return Buffer.concat([dir, ...images.map((i) => i.bytes)]);
}

async function main() {
  const out = (file) => path.join(ROOT, file);
  await mkdir(out('public/icons'), { recursive: true });

  const files = {
    // 48 px står først: Next leser størrelsen i <link sizes="…"> fra det
    // første bildet i fila, og nettleseren velger så riktig bilde selv.
    'app/favicon.ico': await ico([
      { size: 48, svg: markSvg(48, 'small') },
      { size: 32, svg: markSvg(32, 'small') },
      { size: 24, svg: markSvg(24, 'small') },
      { size: 16, svg: markSvg(16, 'pixel16') },
    ]),
    'app/icon.png': await png(markSvg(96, 'small')),
    'app/apple-icon.png': await png(markSvg(180, 'full')),
    'public/icons/icon-192.png': await png(markSvg(192, 'full')),
    'public/icons/icon-512.png': await png(markSvg(512, 'full')),
    'public/icons/icon-maskable-512.png': await png(markSvg(512, 'maskable')),
    'public/icons/nwc-mark.svg': markSvg(512, 'full') + '\n',
  };

  for (const [file, content] of Object.entries(files)) {
    await writeFile(out(file), content);
    console.log(`${file}  ${content.length} byte`);
  }
}

// `--preview <mappe>` skriver hver størrelse som PNG, forstørret, for å se
// på resultatet uten å røre de ferdige filene.
const previewAt = process.argv.indexOf('--preview');
if (previewAt > -1) {
  const dir = path.resolve(process.argv[previewAt + 1] ?? 'icon-preview');
  await mkdir(dir, { recursive: true });
  for (const [size, variant] of [[16, 'pixel16'], [24, 'small'], [32, 'small'], [48, 'small'], [96, 'small'], [180, 'full'], [512, 'full'], [512, 'maskable']]) {
    const raw = await png(markSvg(size, variant));
    const zoom = Math.max(1, Math.round(384 / size));
    const big = await sharp(raw).resize(size * zoom, size * zoom, { kernel: 'nearest' }).png().toBuffer();
    await writeFile(path.join(dir, `${variant}-${size}.png`), raw);
    await writeFile(path.join(dir, `${variant}-${size}@${zoom}x.png`), big);
  }
  console.log(`Forhåndsvisning skrevet til ${dir}`);
} else {
  await main();
}
