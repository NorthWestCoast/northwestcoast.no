'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ALL_IMAGES } from '@/lib/gallery';

const TABS = ['Alle', 'I bruk', 'Leider', 'Oppbevaring', 'Referanser'];

/**
 * Client-side filtering for /galleri, split out so the page itself can stay a
 * server component with metadata and ImageGallery schema.
 */
export default function GalleryTabs() {
  const [activeTab, setActiveTab] = useState('Alle');

  const filtered = activeTab === 'Alle' ? ALL_IMAGES : ALL_IMAGES.filter((img) => img.tag === activeTab);

  const openLightbox = (src: string) => {
    const lb = document.getElementById('lightbox') as HTMLElement | null;
    const img = document.getElementById('lb-img') as HTMLImageElement | null;
    if (lb && img) { img.src = src; lb.classList.add('open'); }
  };

  return (
    <section className="gallery" id="galleri" style={{ paddingTop: '3rem' }}>
      <div className="gallery-tabs" style={{ marginTop: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab${activeTab === tab ? ' active' : ''}`}
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mg-grid" style={{ marginTop: '1.5rem' }}>
        {filtered.map((img, i) => (
          <button
            key={img.src}
            type="button"
            className="mg-card"
            aria-label={`Åpne bilde: ${img.alt}`}
            onClick={() => openLightbox(img.src)}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              // Without `sizes`, next/image assumes the image fills the viewport
              // and ships the largest srcset candidate to every device. This
              // grid is at most three columns, so tell it the truth.
              sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
              loading={i < 3 ? 'eager' : 'lazy'}
              style={{
                objectFit: img.contain ? 'contain' : 'cover',
                background: img.contain ? '#e8e0d4' : undefined,
              }}
            />
            <div className="g-label">{img.label}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
