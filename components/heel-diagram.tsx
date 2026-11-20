'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Dict } from '@/lib/dictionaries/no';
import { HEEL_ANGLE_DEG, heelMargin } from '@/lib/ladder-rules';

/**
 * Tverrsnitt av fartøyet (sett forfra) med målene fra kalkulatoren.
 *
 * Skroget dreies om senterlinjen i vannlinjen, slik at leidersiden løftes.
 * Leideren følger skutesiden, og tillegget under vannlinjen er akkurat så
 * langt at nedre ende ligger i vannflaten ved full krenging – det er det
 * tegningen skal vise.
 *
 * Tegningen finnes i to utgaver: en bred med hele navn på mållinjene og en
 * smal med bokstaver. CSS velger utgave etter plassen (container query), så
 * teksten er lesbar fra 320 px og oppover uten at siden hopper ved lasting.
 */

type Texts = Dict['calculator']['diagram'];

type Props = {
  /** Fribord (F) i meter. 0 betyr at feltet er tomt. */
  freeboard: number;
  /** Høyde fra dekk til festepunkt (h) i meter. 0 betyr festet i dekksnivå. */
  mountHeight: number;
  /** Bredde (B) i meter. 0 betyr at feltet er tomt. */
  beam: number;
  /** Tillegget når brukeren har satt det selv. null: regnes ut fra bredden. */
  manualMargin: number | null;
  heelDeg?: number;
  texts: Texts;
  /** Formaterer et tall i meter (uten enhet) for gjeldende språk. */
  format: (metres: number) => string;
};

/** Tegnes til brukeren har lagt inn egne mål. Meter. */
const EXAMPLE = { freeboard: 1.2, mountHeight: 0.9, beam: 4 };

const UP_MS = 2200;
const HOLD_MS = 900;
const DOWN_MS = 2200;

type Layout = { w: number; h: number; font: number; long: boolean };
const WIDE: Layout = { w: 560, h: 370, font: 13, long: true };
const NARROW: Layout = { w: 300, h: 270, font: 12.5, long: false };

/**
 * Anslått tegnbredde i em. Målt i nettleseren ligger tekstene på 0,42–0,53 em
 * per tegn; tallet er rundet opp, så teksten aldri havner utenfor rammen.
 */
const CHAR_EM = 0.56;

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;
const ease = (t: number) => 0.5 - Math.cos(Math.PI * clamp(t, 0, 1)) / 2;
/** Koordinater med én desimal, så serveren og nettleseren skriver det samme. */
const r1 = (value: number) => Math.round(value * 10) / 10;

type Values = {
  F: number;
  h: number;
  B: number;
  m: number;
  L: number;
  /** Hvilke tall som er eksempler. */
  example: { freeboard: boolean; mount: boolean; beam: boolean };
};

function resolveValues({ freeboard, mountHeight, beam, manualMargin, heelDeg }: Required<Omit<Props, 'texts' | 'format'>>): Values {
  const exF = !(freeboard > 0);
  const exB = !(beam > 0);
  // Festepunktet står på 0 fra start. Vis et eksempel til fribordet er lagt inn.
  const exH = exF && !(mountHeight > 0);

  const F = exF ? EXAMPLE.freeboard : freeboard;
  const h = exH ? EXAMPLE.mountHeight : Math.max(0, mountHeight);
  const B = exB ? EXAMPLE.beam : beam;
  // Uten bredde gir ikke krengingen mening. Da vises tillegget som følger av
  // eksempelbredden, og hele tegningen er merket som eksempel.
  const m = exB || manualMargin === null ? heelMargin(B, heelDeg) : Math.max(0, manualMargin);

  return { F, h, B, m, L: round2(F + h + m), example: { freeboard: exF, mount: exH, beam: exB } };
}

type Labels = {
  beam: string;
  freeboard: string;
  mount: string;
  /** Én linje i bred utgave, to i smal. */
  margin: string[];
  ladder: string;
  reach: string;
};

/** [a, c]: en lengde i piksler som a × målestokk + c. */
type Lin = [number, number];
const need = (list: Lin[], scale: number) => Math.max(...list.map(([a, c]) => a * scale + c));
const fit = (size: number, one: Lin[], two: Lin[]) =>
  Math.min(...one.flatMap(([a1, c1]) => two.map(([a2, c2]) => (size - c1 - c2) / (a1 + a2))));

type Scene = ReturnType<typeof buildScene>;

/**
 * Regner ut hvor alt skal stå. Proporsjonene følger tallene, men innenfor
 * grenser: et svært lavt fribord eller en svært bred båt skal ikke klemme
 * mållinjene sammen. Tallene i teksten er alltid de virkelige.
 *
 * Målestokken velges slik at hele tegningen får plass både rett og ved full
 * krenging, med teksten til mållinjene innenfor rammen.
 */
function buildScene(v: Values, layout: Layout, labels: Labels, heelMax: number) {
  const sin = Math.sin(rad(heelMax));
  const cos = Math.cos(rad(heelMax));
  const width = (text: string, font = layout.font) => text.length * font * CHAR_EM;

  // Mål som tegnes, i meter.
  const B = v.B;
  const F = clamp(v.F, 0.18 * B, 1.1 * B);
  const h = v.h > 0 ? clamp(v.h, 0.09 * B, 0.6 * B) : 0;
  const m = v.m > 0 ? clamp(v.m, 0.07 * B, 0.6 * B) : 0;
  const draft = Math.max(m + 0.1 * B, 0.3 * B);
  const houseH = 0.3 * B;
  const houseW = 0.36 * B;
  const mast = 0.14 * B;

  // Avstander ut fra skutesiden, i piksler.
  const ladderOff = 4;
  const totalOff = 20;
  const chainOff = layout.long ? 36 : 20;
  const textOff = chainOff + 9;
  const ladderLabelOff = layout.long ? 12 : 0;
  const ladderLabelUp = 18;
  const pad = 8;

  const chainLabels = [labels.freeboard, ...(h > 0 ? [labels.mount] : []), ...(m > 0 ? labels.margin : [])];
  const chainW = Math.max(...chainLabels.map((text) => width(text)));
  const marginW = Math.max(...labels.margin.map((text) => width(text)));

  // Plassbehov som a × målestokk + c, rett og ved full krenging.
  const left: Lin[] = [
    [B / 2, pad],
    [(B / 2) * cos + (F + h) * sin, pad],
  ];
  const right: Lin[] = [
    [B / 2, Math.max(textOff + chainW, ladderLabelOff + width(labels.ladder)) + pad],
    [(B / 2) * cos + (m / 2) * sin, textOff * cos + marginW + pad],
    ...(layout.long ? ([[(B / 2) * cos + m * sin, ladderOff + 12 + width(labels.reach, layout.font - 1) + pad]] as Lin[]) : []),
  ];
  const top: Lin[] = [
    [F + houseH + mast, pad],
    [(B / 2) * sin + (F + h) * cos, ladderLabelOff * sin + ladderLabelUp * cos + layout.font + pad],
  ];
  const bottom: Lin[] = [
    [draft, 16 + 14 + layout.font * 0.7 + pad],
    [(B / 2) * sin + draft * cos, pad],
  ];

  const s = Math.max(4, Math.min(fit(layout.w, left, right), fit(layout.h, top, bottom)));
  const leftPx = need(left, s);
  const rightPx = need(right, s);
  const topPx = need(top, s);
  const bottomPx = need(bottom, s);

  const x0 = leftPx + Math.max(0, layout.w - leftPx - rightPx) / 2;
  const y0 = topPx + Math.max(0, layout.h - topPx - bottomPx) / 2;

  const hb = (B / 2) * s;
  const sideX = x0 + hb;
  const portX = x0 - hb;
  const deckY = y0 - F * s;
  const topY = deckY - h * s;
  const keelY = y0 + draft * s;
  const endY = y0 + m * s;
  const bilge = Math.min(0.4 * draft * s, 0.35 * hb);

  const hull = [
    `M ${r1(portX)} ${r1(deckY)}`,
    `L ${r1(portX)} ${r1(keelY - bilge)}`,
    `Q ${r1(portX)} ${r1(keelY)} ${r1(portX + bilge)} ${r1(keelY)}`,
    `L ${r1(sideX - bilge)} ${r1(keelY)}`,
    `Q ${r1(sideX)} ${r1(keelY)} ${r1(sideX)} ${r1(keelY - bilge)}`,
    `L ${r1(sideX)} ${r1(deckY)}`,
    'Z',
  ].join(' ');

  // Leideren: ett trinn per ca. 0,3 m, men aldri tettere enn 7 px.
  const ladderX = sideX + ladderOff;
  const ladderPx = endY - topY;
  const rungCount = clamp(Math.round(v.L * 3) + 1, 3, Math.max(3, Math.floor(ladderPx / 7)));
  const rungs = Array.from({ length: rungCount }, (_, i) => topY + ((i + 0.5) * ladderPx) / rungCount);

  // Målkjeden langs leideren: h, F og tillegget, ovenfra og ned.
  const chainX = sideX + chainOff;
  const segments = [
    ...(h > 0 ? [{ key: 'mount', y1: topY, y2: deckY, lines: [labels.mount] }] : []),
    { key: 'freeboard', y1: deckY, y2: y0, lines: [labels.freeboard] },
    ...(m > 0 ? [{ key: 'margin', y1: y0, y2: endY, lines: labels.margin }] : []),
  ];
  const gap = layout.font + 3;
  const labelYs: number[] = [];
  segments.forEach((segment, index) => {
    const mid = (segment.y1 + segment.y2) / 2;
    labelYs.push(index > 0 ? Math.max(mid, labelYs[index - 1] + gap) : mid);
  });

  const beamY = y0 + draft * s * 0.5;
  const beamGap = width(labels.beam) / 2 + 7;

  return {
    layout,
    s,
    x0,
    y0,
    hb,
    sideX,
    portX,
    deckY,
    topY,
    keelY,
    endY,
    hull,
    house: { x: x0 - (houseW * s) / 2, y: deckY - houseH * s, w: houseW * s, h: houseH * s, mastTop: deckY - (houseH + mast) * s },
    hasRail: h > 0,
    hasMargin: m > 0,
    ladderX,
    rungs,
    totalX: sideX + totalOff,
    chainX,
    textX: sideX + textOff,
    segments: segments.map((segment, index) => ({ ...segment, labelY: labelYs[index] })),
    ladderLabel: { x: sideX + ladderLabelOff, y: topY - ladderLabelUp },
    beamY,
    beamGap,
    arcR: draft * s + 16,
  };
}

function SceneSvg({
  scene,
  angle,
  labels,
  angleText,
  showReach,
  title,
  className,
}: {
  scene: Scene;
  angle: number;
  labels: Labels;
  angleText: string;
  showReach: boolean;
  title: string;
  className: string;
}) {
  const { layout, x0, y0, sideX, portX, deckY, topY, keelY, endY, house, ladderX, chainX, totalX, textX, beamY, beamGap, arcR } = scene;
  const { w, h, font } = layout;
  const a = rad(angle);
  const sinA = Math.sin(a);
  const cosA = Math.cos(a);

  /** Skroget og alt som sitter på det dreies om senterlinjen i vannlinjen. */
  const heel = `rotate(${r1(-angle)} ${r1(x0)} ${r1(y0)})`;
  /** Teksten dreies tilbake om sitt eget feste, så den alltid står vannrett. */
  const level = (x: number, y: number) => `rotate(${r1(angle)} ${r1(x)} ${r1(y)})`;
  /** Et punkt på skroget (piksler fra dreiepunktet, y opp) i tegningens koordinater. */
  const world = (x: number, y: number) => ({ x: x0 + x * cosA - y * sinA, y: y0 - (x * sinA + y * cosA) });

  const end = world(ladderX - x0, y0 - endY);
  const touching = showReach && Math.abs(end.y - y0) < 1.5;
  const arcEnd = { x: x0 + arcR * sinA, y: y0 + arcR * cosA };
  const half = a / 2;
  const angleAt = { x: x0 + (arcR + 14) * Math.sin(half), y: y0 + (arcR + 14) * Math.cos(half) + font * 0.35 };
  const tick = 4;

  return (
    <svg
      className={`heel-svg ${className}`}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={title}
      style={{ fontSize: font }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Skroget */}
      <g transform={heel}>
        <path className="heel-hull" d={scene.hull} />
        {scene.hasRail && (
          <>
            <line className="heel-rail" x1={r1(portX)} y1={r1(deckY)} x2={r1(portX)} y2={r1(topY)} />
            <line className="heel-rail" x1={r1(sideX)} y1={r1(deckY)} x2={r1(sideX)} y2={r1(topY)} />
          </>
        )}
        <rect className="heel-house" x={r1(house.x)} y={r1(house.y)} width={r1(house.w)} height={r1(house.h)} />
        <rect
          className="heel-detail"
          x={r1(house.x + 5)}
          y={r1(house.y + house.h * 0.22)}
          width={r1(Math.max(2, house.w - 10))}
          height={r1(house.h * 0.26)}
        />
        <line className="heel-detail" x1={r1(house.x - 4)} y1={r1(house.y)} x2={r1(house.x + house.w + 4)} y2={r1(house.y)} />
        <line className="heel-detail" x1={r1(x0)} y1={r1(house.y)} x2={r1(x0)} y2={r1(house.mastTop)} />
      </g>

      {/* Vannet ligger foran skroget, så det som er under vann blir dempet. */}
      <rect className="heel-water" x="0" y={r1(y0)} width={w} height={r1(h - y0)} />
      <line className="heel-waterline" x1="0" y1={r1(y0)} x2={w} y2={r1(y0)} />

      {/* Loddlinjen under kjølen og vinkelen mellom den og senterlinjen */}
      <line className="heel-ref" x1={r1(x0)} y1={r1(keelY + 3)} x2={r1(x0)} y2={r1(y0 + arcR + 5)} />
      {angle > 0.2 && (
        <path className="heel-arc" d={`M ${r1(x0)} ${r1(y0 + arcR)} A ${r1(arcR)} ${r1(arcR)} 0 0 0 ${r1(arcEnd.x)} ${r1(arcEnd.y)}`} />
      )}
      <text className="heel-angle-text" x={r1(angleAt.x)} y={r1(angleAt.y)} textAnchor="middle">
        {angleText}
      </text>

      {/* Leider og mållinjer følger skroget */}
      <g transform={heel}>
        <line className="heel-ref" x1={r1(x0)} y1={r1(keelY + 3)} x2={r1(x0)} y2={r1(y0 + arcR + 5)} />

        {/* Bredden, med plass til teksten midt på linja */}
        <path
          className="heel-dim"
          d={[
            `M ${r1(portX + 1)} ${r1(beamY)} L ${r1(x0 - beamGap)} ${r1(beamY)}`,
            `M ${r1(x0 + beamGap)} ${r1(beamY)} L ${r1(sideX - 1)} ${r1(beamY)}`,
            `M ${r1(portX + 1)} ${r1(beamY - tick)} L ${r1(portX + 1)} ${r1(beamY + tick)}`,
            `M ${r1(sideX - 1)} ${r1(beamY - tick)} L ${r1(sideX - 1)} ${r1(beamY + tick)}`,
          ].join(' ')}
        />
        <text className="heel-text" x={r1(x0)} y={r1(beamY + font * 0.35)} textAnchor="middle" transform={level(x0, beamY)}>
          {labels.beam}
        </text>

        {/* Hjelpelinjer fra dekket og fra vannlinjemerket på skutesiden */}
        <path
          className="heel-guide"
          d={[
            `M ${r1(ladderX + 8)} ${r1(deckY)} L ${r1(chainX + tick)} ${r1(deckY)}`,
            ...(scene.hasMargin ? [`M ${r1(ladderX + 8)} ${r1(y0)} L ${r1(chainX + tick)} ${r1(y0)}`] : []),
          ].join(' ')}
        />

        {/* Leideren: krok over festepunktet, vange og trinn */}
        <path
          className="heel-ladder"
          d={[
            `M ${r1(sideX - 5)} ${r1(topY + 3)} L ${r1(sideX - 5)} ${r1(topY - 4)} L ${r1(ladderX)} ${r1(topY - 4)} L ${r1(ladderX)} ${r1(endY)}`,
            ...scene.rungs.map((y) => `M ${r1(ladderX)} ${r1(y)} L ${r1(ladderX + 5)} ${r1(y)}`),
          ].join(' ')}
        />
        <circle className="heel-ladder-end" cx={r1(ladderX)} cy={r1(endY)} r="3.2" />

        {/* Samlet leiderlengde */}
        {layout.long && (
          <path
            className="heel-dim heel-dim-ladder"
            d={[
              `M ${r1(totalX)} ${r1(topY)} L ${r1(totalX)} ${r1(endY)}`,
              `M ${r1(totalX - tick)} ${r1(topY)} L ${r1(totalX + tick)} ${r1(topY)}`,
              `M ${r1(totalX - tick)} ${r1(endY)} L ${r1(totalX + tick)} ${r1(endY)}`,
            ].join(' ')}
          />
        )}
        <text
          className="heel-text heel-text-ladder"
          x={r1(scene.ladderLabel.x)}
          y={r1(scene.ladderLabel.y)}
          transform={level(scene.ladderLabel.x, scene.ladderLabel.y)}
        >
          {labels.ladder}
        </text>

        {/* Målkjeden: h + F + tillegg */}
        <path
          className="heel-dim"
          d={[
            `M ${r1(chainX)} ${r1(topY)} L ${r1(chainX)} ${r1(endY)}`,
            ...[topY, deckY, y0, endY]
              .filter((y, index, all) => all.indexOf(y) === index)
              .map((y) => `M ${r1(chainX - tick)} ${r1(y)} L ${r1(chainX + tick)} ${r1(y)}`),
          ].join(' ')}
        />
        {scene.segments.map((segment) => (
          <text
            key={segment.key}
            className={`heel-text${segment.key === 'margin' ? ' heel-text-margin' : ''}`}
            x={r1(textX)}
            y={r1(segment.labelY + font * 0.35)}
            transform={level(textX, segment.labelY)}
          >
            {segment.lines.map((line, index) => (
              <tspan key={line} x={r1(textX)} dy={index === 0 ? 0 : r1(font + 2)}>
                {line}
              </tspan>
            ))}
          </text>
        ))}
      </g>

      {/* Nedre ende i vannflaten ved full krenging */}
      {touching && (
        <>
          <circle className="heel-reach-ring" cx={r1(end.x)} cy={r1(y0)} r="7" />
          {layout.long && (
            <text className="heel-reach-text" x={r1(end.x + 12)} y={r1(y0 + font + 3)} style={{ fontSize: font - 1 }}>
              {labels.reach}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

export default function HeelDiagram({
  freeboard,
  mountHeight,
  beam,
  manualMargin,
  heelDeg = HEEL_ANGLE_DEG,
  texts,
  format,
}: Props) {
  const sliderId = useId();
  const [angle, setAngle] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  const values = useMemo(
    () => resolveValues({ freeboard, mountHeight, beam, manualMargin, heelDeg }),
    [freeboard, mountHeight, beam, manualMargin, heelDeg],
  );

  // Tekstene på mållinjene og plasseringen av alt, for begge utgavene.
  const { wide, narrow, wideLabels, narrowLabels } = useMemo(() => {
    const metres = (value: number) => `${format(value)} m`;
    const long: Labels = {
      beam: `${texts.beam} ${metres(values.B)}`,
      freeboard: `${texts.freeboard} ${metres(values.F)}`,
      mount: `${texts.mount} ${metres(values.h)}`,
      margin: [`${texts.margin} ${metres(values.m)}`],
      ladder: `${texts.ladder} ${metres(values.L)}`,
      reach: texts.reach,
    };
    const short: Labels = {
      ...long,
      beam: `B ${metres(values.B)}`,
      freeboard: `F ${metres(values.F)}`,
      mount: `h ${metres(values.h)}`,
      margin: [texts.margin, metres(values.m)],
    };
    return {
      wide: buildScene(values, WIDE, long, heelDeg),
      narrow: buildScene(values, NARROW, short, heelDeg),
      wideLabels: long,
      narrowLabels: short,
    };
  }, [values, heelDeg, texts, format]);

  function cancel() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }
  // Stopp en avspilling som pågår når komponenten forsvinner.
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /** Spiller av fra gjeldende vinkel: opp til full krenging, kort stopp, ned igjen. */
  function play(from: number) {
    const up = ((heelDeg - from) / heelDeg) * UP_MS;
    const hold = from >= heelDeg ? 0 : HOLD_MS;
    const total = up + hold + DOWN_MS;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= total) {
        frame.current = null;
        setAngle(0);
        setPlaying(false);
        return;
      }
      if (elapsed < up) setAngle(from + (heelDeg - from) * ease(elapsed / up));
      else if (elapsed < up + hold) setAngle(heelDeg);
      else setAngle(heelDeg * (1 - ease((elapsed - up - hold) / DOWN_MS)));
      frame.current = requestAnimationFrame(step);
    };

    setPlaying(true);
    frame.current = requestAnimationFrame(step);
  }

  function handlePlay() {
    if (playing) {
      cancel();
      setPlaying(false);
      return;
    }
    // Redusert bevegelse: ingen avspilling, bare bytt mellom rett og full krenging.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setAngle((current) => (current >= heelDeg ? 0 : heelDeg));
      return;
    }
    play(angle);
  }

  function handleSlider(value: number) {
    cancel();
    setPlaying(false);
    setAngle(value);
  }

  const degrees = Math.round(angle);
  const angleText = `${degrees}°`;

  // Hvor dypt nedre ende ligger, med de virkelige tallene.
  const depth = values.m * Math.cos(rad(angle)) - (values.B / 2) * Math.sin(rad(angle));
  const atSurface = Math.abs(depth) < 0.01;
  const status = atSurface
    ? texts.statusAt(degrees)
    : depth < 0
      ? texts.statusAbove(degrees, format(round2(-depth)))
      : degrees === 0
        ? texts.statusUpright(format(round2(depth)))
        : texts.statusBelow(degrees, format(round2(depth)));
  const depthAtMax = values.m * Math.cos(rad(heelDeg)) - (values.B / 2) * Math.sin(rad(heelDeg));
  const showReach = Math.abs(depthAtMax) < 0.01;

  const exampleFields = [
    values.example.freeboard ? texts.exampleFreeboard : null,
    values.example.mount ? texts.exampleMount : null,
    values.example.beam ? texts.exampleBeam : null,
  ].filter((field): field is string => field !== null);
  const exampleList =
    exampleFields.length > 1
      ? `${exampleFields.slice(0, -1).join(', ')} ${texts.and} ${exampleFields[exampleFields.length - 1]}`
      : exampleFields[0];

  const title = texts.alt({
    beam: format(values.B),
    freeboard: format(values.F),
    mount: format(values.h),
    margin: format(values.m),
    ladder: format(values.L),
    deg: degrees,
  });

  const buttonLabel = playing ? texts.stop : angle >= heelDeg ? texts.reset : texts.play;

  return (
    <div className="heel">
      {exampleFields.length > 0 && (
        <p className="heel-example">
          <span className="heel-tag">{texts.exampleTag}</span>
          {texts.exampleNote(exampleList)}
        </p>
      )}

      <div className="heel-fig">
        <SceneSvg
          scene={narrow}
          angle={angle}
          labels={narrowLabels}
          angleText={angleText}
          showReach={showReach}
          title={title}
          className="heel-svg-narrow"
        />
        <SceneSvg
          scene={wide}
          angle={angle}
          labels={wideLabels}
          angleText={angleText}
          showReach={showReach}
          title={title}
          className="heel-svg-wide"
        />
      </div>

      <p className={`heel-status${depth < -0.01 ? ' heel-status-warn' : ''}`}>{status}</p>

      <div className="heel-controls">
        <button type="button" className="heel-play" onClick={handlePlay}>
          {buttonLabel}
        </button>
        <div className="heel-slider">
          <label htmlFor={sliderId}>{texts.angle}</label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={heelDeg}
            step={1}
            value={degrees}
            onChange={(event) => handleSlider(Number(event.target.value))}
            aria-valuetext={status}
          />
          <output htmlFor={sliderId}>{angleText}</output>
        </div>
      </div>

      <p className="heel-key">{texts.key}</p>
    </div>
  );
}
