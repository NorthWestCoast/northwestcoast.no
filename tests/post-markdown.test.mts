/**
 * Kontroll av tekstformatet for nyhetsinnlegg (lib/post-markdown.ts) og
 * malen som lastes ned i admin (lib/post-template.ts).
 *
 *   node tests/post-markdown.test.mts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co';

const md = await import('../lib/post-markdown.ts');
const { POST_TEMPLATE, AI_GUIDE } = await import('../lib/post-template.ts');
const lib = await import('../lib/media-library.ts');

let failed = 0;
const check = (name: string, cond: boolean, detail: unknown = '') => {
  console.log(`${cond ? 'OK  ' : 'FEIL'} ${name}${cond ? '' : '  ← ' + JSON.stringify(detail)}`);
  if (!cond) failed++;
};

const MEDIA = 'https://abcxyz.supabase.co/storage/v1/object/public/public-media/';

// ── Hvilke bilder som godtas ────────────────────────────────────────────────
check('posts/… blir en adresse i public-media', md.resolveImage('posts/a1.jpg') === `${MEDIA}posts/a1.jpg`);
check('bibliotek/… blir en adresse i public-media', md.resolveImage('bibliotek/b2.webp') === `${MEDIA}bibliotek/b2.webp`);
check('full adresse til egen lagring godtas', md.resolveImage(`${MEDIA}posts/a1.jpg`) === `${MEDIA}posts/a1.jpg`);
check('fil på nettstedet godtas', md.resolveImage('/images/leiderkasse2.jpg') === '/images/leiderkasse2.jpg');
check('andre nettsteder avvises', md.resolveImage('https://evil.example/x.jpg') === null);
check('protokollrelativ adresse avvises', md.resolveImage('//evil.example/x.jpg') === null);
check('javascript: avvises', md.resolveImage('javascript:alert(1)') === null);
check('.. avvises', md.resolveImage('posts/../secret.jpg') === null && md.resolveImage('/images/../x') === null);
check('mellomrom avvises', md.resolveImage('/images/a b.jpg') === null);
check('annen mappe i bøtta avvises', md.resolveImage('privat/a.jpg') === null);
check('kortform av bibliotekadresse', md.shortImageRef(`${MEDIA}bibliotek/b2.webp`) === 'bibliotek/b2.webp');
check('kortform av full adresse', md.shortImageRef(`${MEDIA}posts/a1.jpg`) === 'posts/a1.jpg');
check('lokalt filnavn kjennes igjen', md.isLocalImageName('kasse.JPG') && md.isLocalImageName('bilder/kasse.webp'));
check('kjente adresser er ikke lokale filnavn', !md.isLocalImageName('posts/a.jpg') && !md.isLocalImageName('bibliotek/a.jpg') && !md.isLocalImageName('/images/a.jpg'));
check('filnøkkel uten mappe og med små bokstaver', md.imageFileKey('Bilder/Kasse-B.JPG') === 'kasse-b.jpg');

// ── Brødteksten ─────────────────────────────────────────────────────────────
const body = [
  'Første avsnitt med **fet** og [lenke](https://northwestcoast.no).',
  '',
  ':::bilder',
  'posts/a.jpg | Kassen på dekk',
  '- /images/b.jpg | Tekst med | strek',
  '',
  'c.jpg',
  ':::',
  '## Mellomtittel',
  '- punkt',
].join('\n');
const blocks = md.parseBody(body);
check('blokkene kommer i rekkefølge', blocks.map((b) => b.kind).join(',') === 'paragraph,gallery,heading,list', blocks.map((b) => b.kind));
const gallery = blocks.find((b) => b.kind === 'gallery');
check('bildeblokken har tre bilder', gallery?.kind === 'gallery' && gallery.images.length === 3, gallery);
check('bildetekst etter første strek', gallery?.kind === 'gallery' && gallery.images[1].caption === 'Tekst med | strek', gallery);
check('bilde uten tekst', gallery?.kind === 'gallery' && gallery.images[2].ref === 'c.jpg' && gallery.images[2].caption === '');
check('ugyldige bilder listes', JSON.stringify(md.invalidImageRefs(body)) === '["c.jpg"]', md.invalidImageRefs(body));
check('blokk uten avsluttende ::: tar resten', md.parseBody(':::images\n/images/a.jpg').length === 1);
check('første avsnitt uten formatering', md.firstParagraph(body) === 'Første avsnitt med fet og lenke.', md.firstParagraph(body));
check('første avsnitt hopper over bildeblokken', md.firstParagraph(':::bilder\n/images/a.jpg\n:::\n\nTekst') === 'Tekst');

const spans = md.findGalleries(body);
check('plasseringen av blokken stemmer', spans.length === 1 && body.slice(spans[0].start, spans[0].end).startsWith(':::bilder') && body.slice(spans[0].start, spans[0].end).endsWith(':::'), spans);
const mapped = md.mapGalleryRefs(body, (ref) => (ref === 'c.jpg' ? 'posts/c.jpg' : ref));
check('mapGalleryRefs bytter bare adressen', mapped.includes('posts/c.jpg |') && mapped.startsWith('Første avsnitt') && mapped.endsWith('- punkt'), mapped);
check('formatGallery gir tilbake det samme', JSON.stringify(md.parseBody(md.formatGallery([{ ref: 'posts/a.jpg', caption: 'Tekst' }]))) === JSON.stringify([{ kind: 'gallery', images: [{ ref: 'posts/a.jpg', caption: 'Tekst' }] }]));

// ── .md-fila ────────────────────────────────────────────────────────────────
const file = md.parsePostFile(`﻿---
tittel: "Sak med «anførsel»"
title: 'English title'
dato: 5.9.2026
ingress: >
  Linje én
  linje to
farge: blå
---

Norsk tekst.

=== English ===

English text.
`);
check('anførselstegn fjernes', file.fields.title_no === 'Sak med «anførsel»' && file.fields.title_en === 'English title', file.fields);
check('norsk dato blir ISO', file.fields.published_date === '2026-09-05', file.fields.published_date);
check('YAML-blokk blir én linje', file.fields.excerpt_no === 'Linje én linje to', file.fields.excerpt_no);
check('tekstene deles ved «=== English ===»', file.fields.body_no === 'Norsk tekst.' && file.fields.body_en === 'English text.', file.fields);
check('ukjent felt gir en merknad', file.notes.some((n) => n.includes('farge')), file.notes);
check('ugyldig dato hoppes over', md.parsePostFile('---\ntittel: A\ndato: 31.02.2026\n---\nx').fields.published_date === '');
check('fil uten felt blir brødtekst', md.parsePostFile('Bare tekst').fields.body_no === 'Bare tekst');

const template = md.parsePostFile(POST_TEMPLATE);
check('malen leses uten merknader', template.notes.length === 0, template.notes);
check('malen har tittel, dato og begge tekstene', Boolean(template.fields.title_no && template.fields.published_date && template.fields.body_no && template.fields.body_en));
check('malens bilder er lokale filnavn', md.galleryEntries(template.fields.body_no).every((e) => md.isLocalImageName(e.ref)));
check('veiledningen inneholder malen', AI_GUIDE.includes(POST_TEMPLATE.trim()));

const fields = { ...template.fields, cover_image_url: `${MEDIA}posts/forside.jpg` };
const again = md.parsePostFile(md.formatPostFile(fields));
check('nedlastet .md leses inn likt igjen', JSON.stringify(again.fields) === JSON.stringify({ ...fields, cover_image_url: 'posts/forside.jpg' }), again.fields);

// ── Bildebiblioteket ────────────────────────────────────────────────────────
const posts = [
  { id: '1', title_no: 'Med bildeblokk', body_no: ':::bilder\nbibliotek/a.jpg | A\n:::', body_en: null, cover_image_url: null },
  { id: '2', title_no: 'Med forsidebilde', body_no: '', body_en: '', cover_image_url: `${MEDIA}bibliotek/a.jpg` },
  { id: '3', title_no: 'Bare engelsk', body_no: '', body_en: ':::images\nposts/b.jpg\n:::', cover_image_url: null },
];
const usage = lib.usageByPath(posts, ['bibliotek/a.jpg', 'posts/b.jpg', 'bibliotek/c.jpg']);
check('bildet i blokk og forsidebilde brukes i to innlegg', usage.get('bibliotek/a.jpg')?.map((p) => p.id).join() === '1,2', usage.get('bibliotek/a.jpg'));
check('bilde i den engelske teksten telles', usage.get('posts/b.jpg')?.[0]?.title === 'Bare engelsk');
check('bilde som ikke brukes, kan slettes', !usage.has('bibliotek/c.jpg'));
check('stiene i biblioteket følger tabellregelen', lib.LIBRARY_PATH.test('bibliotek/0a-b.jpg') && lib.LIBRARY_PATH.test('posts/x.webp') && !lib.LIBRARY_PATH.test('galleri/x.jpg') && !lib.LIBRARY_PATH.test('bibliotek/../x.jpg'));
const image = { id: 'x', storage_path: 'bibliotek/x.jpg', file_name: 'Kasse-dekk.JPG', alt_no: 'Leiderkasse på dekk', alt_en: 'Ladder case', width: 1600, height: 1067, bytes: 420_000, created_at: '' };
check('søket finner ord i beskrivelse og filnavn', lib.matchesSearch(image, 'kasse DEKK') && lib.matchesSearch(image, 'ladder') && !lib.matchesSearch(image, 'kai'));
check('størrelser skrives som kB og MB', lib.formatBytes(420_000) === '410 kB' && lib.formatBytes(1_258_291) === '1,2 MB', [lib.formatBytes(420_000), lib.formatBytes(1_258_291)]);

console.log(failed ? `\n${failed} kontroll(er) feilet.` : '\nAlle kontrollene består.');
process.exit(failed ? 1 : 0);
