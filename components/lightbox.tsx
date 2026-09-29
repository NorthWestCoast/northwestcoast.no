'use client';

import { useEffect } from 'react';
import { useT } from '@/components/lang-provider';

export default function Lightbox() {
  const t = useT();

  useEffect(() => {
    const lb = document.getElementById('lightbox');
    if (!lb) return;

    const closeOnBackdrop = (e: MouseEvent) => {
      if (e.target === lb) lb.classList.remove('open');
    };

    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') lb.classList.remove('open');
    };

    lb.addEventListener('click', closeOnBackdrop);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      lb.removeEventListener('click', closeOnBackdrop);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  function close() {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lb-img') as HTMLImageElement | null;
    if (lb) lb.classList.remove('open');
    if (img) {
      img.removeAttribute('src');
      img.classList.remove('lb-contain');
    }
  }

  return (
    <div id="lightbox" className="lightbox">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img id="lb-img" alt={t.gallery.enlargedAlt} />
      <button className="lb-close" onClick={close} aria-label={t.gallery.close}>✕</button>
    </div>
  );
}
