'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { openLightbox } from '@/lib/gallery-images';
import { getDict, type Lang } from '@/lib/i18n';

export type Slide = { src: string; caption: string; unoptimized: boolean };

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * Lysbildeshow for en bildeblokk («:::bilder») i et innlegg.
 *
 * Alle bildene ligger oppå hverandre, og bare det aktive er synlig. De lastes
 * dermed når showet kommer til syne, ikke først når man blar. Piltaster,
 * sveip og miniatyrene blar; et trykk på bildet viser det større (lightbox).
 */
export default function PostSlideshow({ images, lang }: { images: Slide[]; lang: Lang }) {
  const t = getDict(lang).news.slides;
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const many = images.length > 1;
  const current = images[index] ?? images[0];

  const go = (next: number) => setIndex((next + images.length) % images.length);

  return (
    <figure
      className="post-slides"
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label={t.label}
      onKeyDown={(event) => {
        if (!many) return;
        if (event.key === 'ArrowLeft') go(index - 1);
        if (event.key === 'ArrowRight') go(index + 1);
      }}
    >
      <div
        className="post-slides-frame"
        onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          touchX.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (!many || start === null || end === undefined || Math.abs(end - start) < 40) return;
          go(end < start ? index + 1 : index - 1);
        }}
      >
        {images.map((image, i) => (
          <button
            key={`${image.src}-${i}`}
            type="button"
            className="post-slide"
            data-active={i === index}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            aria-label={`${t.enlarge}${image.caption ? `: ${image.caption}` : ''}`}
            onClick={() => openLightbox(image.src)}
          >
            <Image
              src={image.src}
              alt={image.caption || t.count.replace('{n}', String(i + 1)).replace('{total}', String(images.length))}
              fill
              sizes="(max-width: 760px) 100vw, 720px"
              // Hele bildet vises, også stående bilder i den liggende rammen.
              style={{ objectFit: 'contain' }}
              unoptimized={image.unoptimized}
            />
          </button>
        ))}

        {many && (
          <>
            <button type="button" className="post-slides-nav" data-dir="prev" aria-label={t.prev} onClick={() => go(index - 1)}>
              <Chevron dir="left" />
            </button>
            <button type="button" className="post-slides-nav" data-dir="next" aria-label={t.next} onClick={() => go(index + 1)}>
              <Chevron dir="right" />
            </button>
          </>
        )}
      </div>

      {(current?.caption || many) && (
        <figcaption className="post-slides-caption">
          <span aria-live="polite">{current?.caption}</span>
          {many && (
            <span className="post-slides-count" aria-label={t.count.replace('{n}', String(index + 1)).replace('{total}', String(images.length))}>
              {index + 1} / {images.length}
            </span>
          )}
        </figcaption>
      )}

      {many && (
        <div className="post-slides-thumbs">
          {images.map((image, i) => (
            <button
              key={`${image.src}-${i}`}
              type="button"
              aria-label={t.count.replace('{n}', String(i + 1)).replace('{total}', String(images.length))}
              aria-current={i === index}
              onClick={() => go(i)}
            >
              <Image src={image.src} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} unoptimized={image.unoptimized} />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
