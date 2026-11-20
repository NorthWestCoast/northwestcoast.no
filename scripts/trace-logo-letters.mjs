/**
 * Henter bokstavene N, W og C ut av selskapets eget ordmerke som kurver.
 *
 *   node scripts/trace-logo-letters.mjs
 *
 * Kjøres bare hvis ordmerket byttes ut. Resultatet (tre SVG-baner) limes inn
 * øverst i scripts/generate-icons.mjs, som lager selve ikonene.
 *
 * Hvorfor: favikonet skal ha de samme bokstavene som logoen, og de skal se
 * like ut i alle nettlesere. En systemskrift i en SVG gir ulike bokstaver fra
 * maskin til maskin, og den kvadratiske logoen (public/images/logo/logo.png)
 * er en 225 px JPEG som blir grøtete når den skaleres. Ordmerket
 * (NY-logo.png) er derimot stort nok til å tegnes av: N og W hentes fra
 * «NORTHWEST», C fra «COAST» og skaleres opp til samme versalhøyde.
 *
 * Metode: konturen finnes med marching squares på alfakanalen (lineær
 * interpolasjon gir delpiksel-nøyaktighet). Lange rette kanter (stammer og
 * skråstreker) blir rette linjer, hjørner beholdes skarpe, og resten
 * tilpasses kubiske bézierkurver (Schneiders algoritme).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public/images/logo/NY-logo.png');

/**
 * Bokstavenes plass i ordmerket (piksler): [x0, y0, x1, y1]. `straight` sier
 * om bokstaven har rette kanter som skal bli rette linjer. C har ingen, og
 * uten flagget ville de slakeste delene av buen blitt flatet ut.
 */
const GLYPHS = {
  N: { box: [30, 48, 204, 212], straight: true },
  W: { box: [900, 48, 1126, 212], straight: true },
  C: { box: [538, 238, 636, 344], straight: false },
  // Brukes bare til å måle versalhøyden i «COAST» (T har ingen oversving).
  T: { box: [942, 238, 1034, 344], straight: true },
};

/** Versalhøyden bokstavene normaliseres til. */
const CAP = 100;
/** Største tillatte avvik mellom kontur og kurve, i kildepiksler. */
const TOLERANCE = 0.22;
/** En kant regnes som rett når den er minst så lang (kildepiksler) … */
const STRAIGHT_MIN = 12;
/** … og konturen aldri ligger lenger unna linja enn dette. */
const STRAIGHT_DEVIATION = 0.28;
/** Hvor langt ut (kildepiksler) en tangent måles. */
const TANGENT_SPAN = 3.5;

// ── Vektorhjelpere ──────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

// ── Marching squares ────────────────────────────────────────────────────
/** Lukkede konturer rundt alt som er mer enn halvveis dekkende. */
function contours(alpha, width, height) {
  const v = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : alpha[y * width + x] / 255);
  const T = 0.5;
  const cross = (a, b) => (T - a) / (b - a);
  const segments = [];

  for (let y = -1; y < height; y++) {
    for (let x = -1; x < width; x++) {
      const tl = v(x, y), tr = v(x + 1, y), br = v(x + 1, y + 1), bl = v(x, y + 1);
      const idx = (tl > T ? 8 : 0) | (tr > T ? 4 : 0) | (br > T ? 2 : 0) | (bl > T ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      // Kantenes skjæringspunkt. Pikselsentre ligger på (x + 0.5, y + 0.5).
      const top = () => [x + 0.5 + cross(tl, tr), y + 0.5];
      const right = () => [x + 1.5, y + 0.5 + cross(tr, br)];
      const bottom = () => [x + 0.5 + cross(bl, br), y + 1.5];
      const left = () => [x + 0.5, y + 0.5 + cross(tl, bl)];
      const centre = (tl + tr + br + bl) / 4 > T;
      // Retning: fyllet ligger til høyre for strekens retning.
      const table = {
        1: [[bottom, left]], 2: [[right, bottom]], 3: [[right, left]], 4: [[top, right]],
        5: centre ? [[top, left], [bottom, right]] : [[top, right], [bottom, left]],
        6: [[top, bottom]], 7: [[top, left]], 8: [[left, top]], 9: [[bottom, top]],
        10: centre ? [[left, bottom], [right, top]] : [[left, top], [right, bottom]],
        11: [[right, top]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const [from, to] of table[idx]) segments.push([from(), to()]);
    }
  }

  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const byStart = new Map(segments.map((s) => [key(s[0]), s]));
  const used = new Set();
  const loops = [];
  for (const first of segments) {
    if (used.has(first)) continue;
    const loop = [];
    let s = first;
    while (s && !used.has(s)) {
      used.add(s);
      loop.push(s[0]);
      s = byStart.get(key(s[1]));
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

// ── Hjørner ─────────────────────────────────────────────────────────────
/** Indeksene der konturen knekker (seriffspisser, strekender). */
function corners(loop, reach = 3.2, minAngle = 38) {
  const n = loop.length;
  const walk = (i, dir) => {
    let travelled = 0, j = i;
    while (travelled < reach) {
      const k = (j + dir + n) % n;
      travelled += len(sub(loop[k], loop[j]));
      j = k;
      if (j === i) break;
    }
    return loop[j];
  };
  const angle = loop.map((p, i) => {
    const a = norm(sub(p, walk(i, -1)));
    const b = norm(sub(walk(i, 1), p));
    return (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;
  });
  const found = [];
  for (let i = 0; i < n; i++) {
    if (angle[i] < minAngle) continue;
    let peak = true;
    for (let d = -4; d <= 4; d++) {
      if (d === 0) continue;
      const other = angle[(i + d + n) % n];
      if (other > angle[i] || (other === angle[i] && d < 0)) peak = false;
    }
    if (peak) found.push(i);
  }
  return found;
}

// ── Schneiders kurvetilpasning ──────────────────────────────────────────
const bezier = (c, t) => {
  const m = 1 - t;
  return [
    m * m * m * c[0][0] + 3 * m * m * t * c[1][0] + 3 * m * t * t * c[2][0] + t * t * t * c[3][0],
    m * m * m * c[0][1] + 3 * m * m * t * c[1][1] + 3 * m * t * t * c[2][1] + t * t * t * c[3][1],
  ];
};

function chordParams(pts) {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + len(sub(pts[i], pts[i - 1])));
  const total = u[u.length - 1] || 1;
  return u.map((x) => x / total);
}

function generate(pts, u, t1, t2) {
  const first = pts[0], last = pts[pts.length - 1];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i], m = 1 - t;
    const b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
    const a1 = mul(t1, b1), a2 = mul(t2, b2);
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
    const rest = sub(pts[i], add(mul(first, b0 + b1), mul(last, b2 + b3)));
    x0 += dot(a1, rest); x1 += dot(a2, rest);
  }
  const det = c00 * c11 - c01 * c01;
  const chord = len(sub(last, first));
  let l1 = Math.abs(det) > 1e-9 ? (x0 * c11 - x1 * c01) / det : 0;
  let l2 = Math.abs(det) > 1e-9 ? (c00 * x1 - c01 * x0) / det : 0;
  if (l1 < chord * 1e-3 || l2 < chord * 1e-3) l1 = l2 = chord / 3;
  return [first, add(first, mul(t1, l1)), add(last, mul(t2, l2)), last];
}

function maxError(pts, c, u) {
  let worst = 0, at = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len(sub(bezier(c, u[i]), pts[i]));
    if (d > worst) { worst = d; at = i; }
  }
  return [worst, at];
}

function reparam(pts, c, u) {
  const d1 = [mul(sub(c[1], c[0]), 3), mul(sub(c[2], c[1]), 3), mul(sub(c[3], c[2]), 3)];
  const d2 = [mul(sub(d1[1], d1[0]), 2), mul(sub(d1[2], d1[1]), 2)];
  const q = (p, t) => { const m = 1 - t; return add(add(mul(p[0], m * m), mul(p[1], 2 * m * t)), mul(p[2], t * t)); };
  const l = (p, t) => add(mul(p[0], 1 - t), mul(p[1], t));
  return u.map((t, i) => {
    const diff = sub(bezier(c, t), pts[i]);
    const v1 = q(d1, t), v2 = l(d2, t);
    const den = dot(v1, v1) + dot(diff, v2);
    return Math.abs(den) < 1e-9 ? t : Math.max(0, Math.min(1, t - dot(diff, v1) / den));
  });
}

const asLine = (a, b) => [a, add(a, mul(sub(b, a), 1 / 3)), add(a, mul(sub(b, a), 2 / 3)), b];

function fit(pts, t1, t2, tol, out) {
  let arc = 0;
  for (let i = 1; i < pts.length; i++) arc += len(sub(pts[i], pts[i - 1]));
  // Bitte små strekk (tuppen av en seriff) tegnes punkt for punkt. En kurve
  // gjennom to–tre punkter med usikre tangenter slår lett ut i en pigg.
  if (pts.length <= 3 || arc < 3) {
    for (let i = 1; i < pts.length; i++) out.push(asLine(pts[i - 1], pts[i]));
    return;
  }
  // En kurve med håndtak lengre enn selve strekket er en løkke eller en pigg,
  // selv om den treffer målepunktene. Da deles strekket i stedet.
  const sane = (c) => len(sub(c[1], c[0])) <= arc && len(sub(c[2], c[3])) <= arc;
  let u = chordParams(pts);
  let c = generate(pts, u, t1, t2);
  let [err, split] = maxError(pts, c, u);
  if (err < tol && sane(c)) return void out.push(c);
  if (err < tol * 4) {
    for (let i = 0; i < 6; i++) {
      u = reparam(pts, c, u);
      c = generate(pts, u, t1, t2);
      [err, split] = maxError(pts, c, u);
      if (err < tol && sane(c)) return void out.push(c);
    }
  }
  if (!sane(c)) split = Math.floor(pts.length / 2);
  // Tangenten i delingspunktet måles over noen piksler til hver side. Tas den
  // fra nabopunktene alene, gir kantutjevningen små knekk i buen.
  let lo = split, hi = split;
  while (lo > 0 && len(sub(pts[lo], pts[split])) < TANGENT_SPAN) lo--;
  while (hi < pts.length - 1 && len(sub(pts[hi], pts[split])) < TANGENT_SPAN) hi++;
  const centre = norm(sub(pts[lo], pts[hi]));
  fit(pts.slice(0, split + 1), t1, centre, tol, out);
  fit(pts.slice(split), mul(centre, -1), t2, tol, out);
}

/** Tangent i enden av et strekk, målt over noen piksler så støy ikke slår ut. */
function endTangent(pts, fromStart) {
  const a = fromStart ? pts[0] : pts[pts.length - 1];
  let i = fromStart ? 1 : pts.length - 2;
  const step = fromStart ? 1 : -1;
  while (i + step >= 0 && i + step < pts.length && len(sub(pts[i], a)) < TANGENT_SPAN) i += step;
  return norm(sub(pts[i], a));
}

/** Douglas–Peucker på en lukket løkke: indeksene som blir stående. */
function simplify(loop, eps) {
  const n = loop.length;
  let far = 0, best = -1;
  for (let i = 1; i < n; i++) {
    const d = len(sub(loop[i], loop[0]));
    if (d > best) { best = d; far = i; }
  }
  const keep = new Set([0, far]);
  const distance = (p, a, b) => {
    const ab = sub(b, a), l = len(ab);
    if (l < 1e-9) return len(sub(p, a));
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (l * l)));
    return len(sub(p, add(a, mul(ab, t))));
  };
  const recurse = (from, to) => {
    // «to» kan være n (tilbake til start).
    let worst = 0, at = -1;
    for (let i = from + 1; i < to; i++) {
      const d = distance(loop[i], loop[from], loop[to % n]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > eps) { keep.add(at); recurse(from, at); recurse(at, to); }
  };
  recurse(0, far);
  recurse(far, n);
  return [...keep].sort((a, b) => a - b);
}

/**
 * Deler løkka i rette kanter og buede strekk. Returnerer segmenter på formen
 * { line: [p0, p1] } eller { curve: [p0, c1, c2, p1] }.
 */
/**
 * Jevner ut trappetrinnene kantutjevningen etterlater i konturen. Punkter
 * like ved et hjørne får stå, ellers ville spissene blitt rundet av.
 */
function smooth(loop) {
  const n = loop.length;
  const fixed = new Set();
  for (const c of corners(loop)) for (let d = -2; d <= 2; d++) fixed.add((c + d + n) % n);
  return loop.map((p, i) => {
    if (fixed.has(i)) return p;
    const a = loop[(i - 1 + n) % n], b = loop[(i + 1) % n];
    return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
  });
}

function loopToSegments(raw, straight) {
  const loop = smooth(raw);
  const n = loop.length;
  const poly = straight ? simplify(loop, STRAIGHT_DEVIATION) : [];
  const straightFrom = new Map(); // startindeks → sluttindeks
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    if (len(sub(loop[b], loop[a])) >= STRAIGHT_MIN) straightFrom.set(a, b);
  }
  const breaks = new Set(corners(loop));
  for (const [a, b] of straightFrom) { breaks.add(a); breaks.add(b); }
  // Et hjørne som ligger inne i en rett kant er støy fra kantutjevningen.
  for (const [a, b] of straightFrom) {
    for (let i = (a + 1) % n; i !== b; i = (i + 1) % n) breaks.delete(i);
  }
  let cuts = [...breaks].sort((a, b) => a - b);
  // Uten faste punkter (en ren oval) deles løkka i fire like strekk.
  if (cuts.length < 2) cuts = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4)];

  const isCorner = new Set(corners(loop));
  const out = [];
  for (let k = 0; k < cuts.length; k++) {
    const from = cuts[k], to = cuts[(k + 1) % cuts.length];
    if (straightFrom.get(from) === to) {
      out.push({ line: [loop[from], loop[to]] });
      continue;
    }
    const run = [];
    for (let i = from; ; i = (i + 1) % n) {
      run.push(loop[i]);
      if (i === to && run.length > 1) break;
    }
    // Der en bue går mykt over i en rett kant, arver den kantens retning.
    const prev = cuts[(k - 1 + cuts.length) % cuts.length];
    const next = cuts[(k + 2) % cuts.length];
    let t1 = endTangent(run, true), t2 = endTangent(run, false);
    if (straightFrom.get(prev) === from && !isCorner.has(from)) {
      const dir = norm(sub(loop[from], loop[prev]));
      if (dot(dir, t1) > 0.9) t1 = dir;
    }
    if (straightFrom.get(to) === next && !isCorner.has(to)) {
      const dir = norm(sub(loop[to], loop[next]));
      if (dot(dir, t2) > 0.9) t2 = dir;
    }
    const curves = [];
    fit(run, t1, t2, TOLERANCE, curves);
    for (const c of curves) out.push({ curve: c });
  }
  return out;
}

// ── Kjøring ─────────────────────────────────────────────────────────────
async function trace({ box, straight }) {
  const [x0, y0, x1, y1] = box;
  const width = x1 - x0, height = y1 - y0;
  const alpha = await sharp(SOURCE)
    .extract({ left: x0, top: y0, width, height })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer();
  const loops = contours(alpha, width, height).map((loop) => loopToSegments(loop, straight));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const loop of loops) for (const s of loop) {
    const samples = s.line ?? [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => bezier(s.curve, t));
    for (const p of samples) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
  }
  return { loops, minX, minY, maxX, maxY };
}

/** En kurve der håndtakene ligger på korden er en rett strek. */
function isStraight(c) {
  const chord = sub(c[3], c[0]);
  const l = len(chord) || 1;
  const off = (p) => Math.abs((p[0] - c[0][0]) * chord[1] - (p[1] - c[0][1]) * chord[0]) / l;
  return off(c[1]) < 0.05 && off(c[2]) < 0.05;
}

function toPath(glyph, scale, originX, originY) {
  const f = (p) => `${+((p[0] - originX) * scale).toFixed(2)} ${+((p[1] - originY) * scale).toFixed(2)}`;
  return glyph.loops
    .map((loop) => {
      const start = (loop[0].line ?? loop[0].curve)[0];
      const body = loop
        .map((s) => (s.line || isStraight(s.curve) ? `L${f((s.line ?? s.curve).at(-1))}` : `C${f(s.curve[1])} ${f(s.curve[2])} ${f(s.curve[3])}`))
        .join('');
      return `M${f(start)}${body}Z`;
    })
    .join('');
}

const N = await trace(GLYPHS.N);
const W = await trace(GLYPHS.W);
const C = await trace(GLYPHS.C);
const T = await trace(GLYPHS.T);

// N har rette topper og bunner: høyden dens er versalhøyden i «NORTHWEST».
const capLarge = N.maxY - N.minY;
const capSmall = T.maxY - T.minY;
const scaleLarge = CAP / capLarge;
const scaleSmall = CAP / capSmall;
// Bokstavene i hver linje deler grunnlinje: bunnen av N og bunnen av T.
const result = {
  N: { d: toPath(N, scaleLarge, N.minX, N.minY), width: +((N.maxX - N.minX) * scaleLarge).toFixed(2) },
  W: { d: toPath(W, scaleLarge, W.minX, N.minY + GLYPHS.N.box[1] - GLYPHS.W.box[1]), width: +((W.maxX - W.minX) * scaleLarge).toFixed(2) },
  C: { d: toPath(C, scaleSmall, C.minX, T.minY + GLYPHS.T.box[1] - GLYPHS.C.box[1]), width: +((C.maxX - C.minX) * scaleSmall).toFixed(2) },
};

console.log(`// Versalhøyde ${CAP}. Kilde: public/images/logo/NY-logo.png (scripts/trace-logo-letters.mjs).`);
console.log('const LETTERS = ' + JSON.stringify(result, null, 2) + ';');
