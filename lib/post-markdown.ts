/**
 * Tekstformatet for nyhetsinnlegg, delt av nettsiden, admin og .md-importen.
 *
 * Brødteksten er ren tekst med et lite markdown-utvalg:
 *
 *   blank linje          nytt avsnitt
 *   ## Tittel            mellomtittel
 *   - punkt              punktliste
 *   **fet**              utheving
 *   [tekst](https://…)   lenke (bare http og https)
 *
 *   :::bilder            bildeblokk, vises som lysbildeshow
 *   bibliotek/abc.jpg | Bildetekst
 *   /images/kasse.jpg | Bildetekst
 *   :::
 *
 * En .md-fil (mal og import i admin) har i tillegg felt øverst mellom to
 * «---»-linjer, og den engelske teksten etter linja «=== English ===».
 *
 * Ingenting her tolkes som HTML. Bildene kan bare komme fra nettstedets egne
 * filer eller fra den offentlige bøtta, se resolveImage.
 */

// ── Bilder ──────────────────────────────────────────────────────────────────

/** Bøtta der bildene til nyhetene lastes opp (BUCKETS.media). */
const MEDIA_BUCKET = 'public-media';

/** Starten på offentlige adresser i prosjektets egen lagring. */
const OWN_MEDIA = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')}/storage/v1/object/public/`;

/**
 * «bibliotek/<navn>.jpg»: et bilde i public-media, uten resten av adressen.
 * Bildebiblioteket laster opp til bibliotek/; posts/ er bilder fra før det.
 */
const MEDIA_PATH = /^(bibliotek|posts)\/[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/**
 * Adressen et bilde i en bildeblokk (eller forsidebildet) vises fra, eller
 * null når det ikke er et bilde vi godtar:
 *
 *   bibliotek/… eller posts/…       fil i public-media (lastet opp i admin)
 *   https://<prosjekt>/storage/…    full adresse til den samme lagringen
 *   /images/…                       fil i nettstedets /public
 *
 * Adresser til andre nettsteder godtas ikke. Ellers kunne den som skriver
 * innlegg fått alle besøkendes nettlesere til å hente noe fra en vert hun
 * selv valgte.
 */
export function resolveImage(ref: string | null | undefined): string | null {
  const value = (ref ?? '').trim();
  if (!value || /[\s\\]/.test(value) || value.includes('..')) return null;

  if (MEDIA_PATH.test(value)) return `${OWN_MEDIA}${MEDIA_BUCKET}/${value}`;
  if (OWN_MEDIA.startsWith('https://') && value.startsWith(OWN_MEDIA)) return value;
  if (
    process.env.NODE_ENV !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+\/storage\/v1\/object\/public\/\S+$/.test(value)
  ) {
    return value;
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return null;
}

/** Kortformen «bibliotek/…» for en full adresse i public-media, ellers adressen uendret. */
export function shortImageRef(url: string): string {
  const prefix = `${OWN_MEDIA}${MEDIA_BUCKET}/`;
  if (url.startsWith(prefix)) {
    const rest = url.slice(prefix.length);
    if (MEDIA_PATH.test(rest)) return rest;
  }
  return url;
}

/** Ser ut som et filnavn fra maskinen til den som skriver (ikke en adresse vi kjenner). */
export function isLocalImageName(ref: string): boolean {
  return (
    resolveImage(ref) === null &&
    !/^[a-z]+:/i.test(ref) &&
    /^[^\s|\\]+\.(jpe?g|png|webp|avif)$/i.test(ref.trim())
  );
}

/** Filnavnet uten mapper, med små bokstaver, så «Bilder/Kasse.JPG» treffer «kasse.jpg». */
export function imageFileKey(name: string): string {
  return (name.split(/[\\/]/).pop() ?? name).trim().toLowerCase();
}

// ── Brødteksten ─────────────────────────────────────────────────────────────

export type GalleryEntry = { ref: string; caption: string };

export type BodyBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'gallery'; images: GalleryEntry[] };

const GALLERY_OPEN = /^:::\s*(bilder|images|galleri|gallery)\s*$/i;
const GALLERY_CLOSE = /^:::\s*$/;

/** «posts/a.jpg | Tekst» → { ref, caption }. Tomme linjer gir null. */
function galleryLine(line: string): GalleryEntry | null {
  const trimmed = line.trim().replace(/^-\s+/, '');
  if (!trimmed) return null;
  const bar = trimmed.indexOf('|');
  if (bar === -1) return { ref: trimmed, caption: '' };
  return { ref: trimmed.slice(0, bar).trim(), caption: trimmed.slice(bar + 1).trim() };
}

export function parseBody(source: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  // Avsnittet, lista eller bildeblokken som fortsatt tar imot linjer.
  let open: Extract<BodyBlock, { kind: 'paragraph' | 'list' }> | null = null;
  let gallery: Extract<BodyBlock, { kind: 'gallery' }> | null = null;

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();

    if (gallery) {
      if (GALLERY_CLOSE.test(line)) {
        gallery = null;
      } else {
        const entry = galleryLine(line);
        if (entry) gallery.images.push(entry);
      }
      continue;
    }

    if (GALLERY_OPEN.test(line)) {
      open = null;
      gallery = { kind: 'gallery', images: [] };
      blocks.push(gallery);
    } else if (!line) {
      open = null;
    } else if (line.startsWith('## ')) {
      open = null;
      blocks.push({ kind: 'heading', text: line.slice(3).trim() });
    } else if (line.startsWith('- ')) {
      if (open?.kind !== 'list') {
        open = { kind: 'list', items: [] };
        blocks.push(open);
      }
      open.items.push(line.slice(2).trim());
    } else {
      if (open?.kind !== 'paragraph') {
        open = { kind: 'paragraph', lines: [] };
        blocks.push(open);
      }
      open.lines.push(line);
    }
  }

  return blocks;
}

/** Alle bildene i brødteksten, i rekkefølge. */
export function galleryEntries(body: string): GalleryEntry[] {
  return parseBody(body).flatMap((block) => (block.kind === 'gallery' ? block.images : []));
}

/**
 * Bildeblokkene med plassering i teksten, så admin kan skrive dem om:
 * `start`/`end` dekker blokken fra «:::bilder» til og med «:::».
 */
export type GallerySpan = { start: number; end: number; images: GalleryEntry[] };

export function findGalleries(source: string): GallerySpan[] {
  const spans: GallerySpan[] = [];
  let current: GallerySpan | null = null;
  let offset = 0;

  for (const line of source.split('\n')) {
    const lineEnd = offset + line.length;
    const trimmed = line.trim();

    if (current) {
      if (GALLERY_CLOSE.test(trimmed)) {
        current.end = lineEnd;
        current = null;
      } else {
        const entry = galleryLine(trimmed);
        if (entry) current.images.push(entry);
        current.end = lineEnd;
      }
    } else if (GALLERY_OPEN.test(trimmed)) {
      current = { start: offset, end: lineEnd, images: [] };
      spans.push(current);
    }
    offset = lineEnd + 1;
  }

  return spans;
}

/** Bildeblokken som tekst. */
export function formatGallery(images: GalleryEntry[]): string {
  const lines = images.map(({ ref, caption }) => {
    const text = caption.replace(/[\r\n]+/g, ' ').trim();
    return text ? `${ref} | ${text}` : `${ref} |`;
  });
  return [':::bilder', ...lines, ':::'].join('\n');
}

/** Bytter bildeadressene i alle bildeblokkene (resten av teksten står urørt). */
export function mapGalleryRefs(source: string, map: (ref: string) => string): string {
  const spans = findGalleries(source);
  let result = source;
  for (const span of [...spans].reverse()) {
    const images = span.images.map((image) => ({ ...image, ref: map(image.ref) }));
    result = result.slice(0, span.start) + formatGallery(images) + result.slice(span.end);
  }
  return result;
}

/** Bilder i teksten som ikke kan vises (feil adresse, eller et filnavn som ikke er lastet opp). */
export function invalidImageRefs(body: string): string[] {
  return galleryEntries(body)
    .map((entry) => entry.ref)
    .filter((ref) => resolveImage(ref) === null);
}

/** Første avsnitt uten formatering, til ingressen når innlegget ikke har en. */
export function firstParagraph(body: string): string {
  const paragraph = parseBody(body).find((block) => block.kind === 'paragraph');
  if (!paragraph || paragraph.kind !== 'paragraph') return '';
  return paragraph.lines
    .join(' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── .md-fila ────────────────────────────────────────────────────────────────

/** Feltene i en .md-fil, med samme navn som feltene i skjemaet i admin. */
export type PostFileFields = {
  title_no: string;
  title_en: string;
  slug: string;
  published_date: string;
  tag_no: string;
  tag_en: string;
  excerpt_no: string;
  excerpt_en: string;
  cover_image_url: string;
  body_no: string;
  body_en: string;
};

/** Navnene øverst i fila → feltet i skjemaet. Begge språk godtas der det er naturlig. */
const KEYS: Record<string, keyof PostFileFields> = {
  tittel: 'title_no',
  title: 'title_en',
  adresse: 'slug',
  slug: 'slug',
  dato: 'published_date',
  date: 'published_date',
  stikkord: 'tag_no',
  tag: 'tag_en',
  ingress: 'excerpt_no',
  excerpt: 'excerpt_en',
  forsidebilde: 'cover_image_url',
  cover: 'cover_image_url',
};

const ENGLISH_MARKER = /^===\s*(english|engelsk)\s*===\s*$/i;

/** Fjerner anførselstegn rundt en verdi, slik AI ofte skriver YAML. */
function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1).replace(/\\"/g, '"').trim();
  }
  return v;
}

/** «30.08.2026» eller «2026-08-30» → «2026-08-30». Ellers tom. */
function isoDay(value: string): string {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const nor = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : nor ? [nor[3], nor[2].padStart(2, '0'), nor[1].padStart(2, '0')] : [];
  if (!y) return '';
  const date = new Date(`${y}-${m}-${d}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${y}-${m}-${d}` ? '' : `${y}-${m}-${d}`;
}

export type ParsedPostFile = {
  fields: PostFileFields;
  /** Ting den som importerer bør vite om. Ingen av dem stopper importen. */
  notes: string[];
};

/** Leser en .md-fil laget etter malen. */
export function parsePostFile(text: string): ParsedPostFile {
  const fields: PostFileFields = {
    title_no: '', title_en: '', slug: '', published_date: '', tag_no: '', tag_en: '',
    excerpt_no: '', excerpt_en: '', cover_image_url: '', body_no: '', body_en: '',
  };
  const notes: string[] = [];
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');

  let index = 0;
  while (index < lines.length && !lines[index].trim()) index++;

  if (lines[index]?.trim() === '---') {
    const close = lines.findIndex((line, i) => i > index && line.trim() === '---');
    if (close === -1) {
      notes.push('Feltene øverst mangler den avsluttende «---»-linja, så hele fila ble lest som brødtekst.');
    } else {
      for (let i = index + 1; i < close; i++) {
        const line = lines[i];
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const match = /^([A-Za-zÆØÅæøå_]+)\s*:\s*(.*)$/.exec(line.trim());
        if (!match) {
          notes.push(`Linja «${line.trim()}» øverst i fila ble hoppet over.`);
          continue;
        }
        const key = KEYS[match[1].toLowerCase()];
        if (!key) {
          notes.push(`Ukjent felt «${match[1]}» ble hoppet over.`);
          continue;
        }
        let value = match[2].trim();
        // «ingress: >» eller «|» etterfulgt av innrykkede linjer (YAML-blokk).
        if (value === '>' || value === '|' || value === '>-' || value === '|-') {
          const parts: string[] = [];
          while (i + 1 < close && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
          value = parts.join(' ');
        }
        fields[key] = unquote(value);
      }
      index = close + 1;
    }
  }

  const body = lines.slice(index);
  const marker = body.findIndex((line) => ENGLISH_MARKER.test(line.trim()));
  fields.body_no = (marker === -1 ? body : body.slice(0, marker)).join('\n').trim();
  fields.body_en = marker === -1 ? '' : body.slice(marker + 1).join('\n').trim();

  if (fields.published_date) {
    const day = isoDay(fields.published_date);
    if (!day) notes.push(`Datoen «${fields.published_date}» er ikke gyldig og ble hoppet over. Skriv den som 2026-08-30.`);
    fields.published_date = day;
  }
  if (!fields.title_no) notes.push('Fila mangler «tittel:», så den norske tittelen må fylles inn for hånd.');

  return { fields, notes };
}

/** Innlegget som .md-fil, slik malen ser ut. Kan importeres igjen uendret. */
export function formatPostFile(fields: PostFileFields): string {
  const line = (key: string, value: string) => `${key}: ${value.replace(/[\r\n]+/g, ' ').trim()}`;
  const head = [
    '---',
    line('tittel', fields.title_no),
    line('title', fields.title_en),
    line('adresse', fields.slug),
    line('dato', fields.published_date),
    line('stikkord', fields.tag_no),
    line('tag', fields.tag_en),
    line('ingress', fields.excerpt_no),
    line('excerpt', fields.excerpt_en),
    line('forsidebilde', fields.cover_image_url ? shortImageRef(fields.cover_image_url) : ''),
    '---',
  ];
  const parts = [head.join('\n'), fields.body_no.trim()];
  if (fields.body_en.trim()) parts.push('=== English ===', fields.body_en.trim());
  return `${parts.join('\n\n')}\n`;
}
