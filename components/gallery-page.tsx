'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useT } from '@/components/lang-provider';
import { CONTAIN_BG, openLightbox, type GalleryItem, type ImageTag } from '@/lib/gallery-images';

type Tab = ImageTag | 'all';

const TABS: Tab[] = ['all', 'inUse', 'ladder', 'storage', 'references'];

/**
 * Hele galleriet med faner. `images` er de faste bildene og bildene fra admin,
 * ferdig oversatt og i riktig rekkefølge (lib/gallery.ts).
 */
export default function GalleryPage({ images }: { images: GalleryItem[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const t = useT();

  const filtered = activeTab === 'all' ? images : images.filter((img) => img.tag === activeTab);

  return (
    <section className="gallery" id="galleri" style={{ paddingTop: '3rem' }}>
      <div className="gallery-tabs" style={{ marginTop: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t.gallery.tabs[tab]}
          </button>
        ))}
      </div>

      <div className="mg-grid" style={{ marginTop: '1.5rem' }}>
        {filtered.map((img) => (
          <div
            key={img.id}
            className="mg-card"
            onClick={() => openLightbox(img.src, img.contain && !img.backdrop)}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill sizes="(max-width: 900px) 50vw, 25vw"
              unoptimized={img.unoptimized}
              style={{
                objectFit: img.contain ? 'contain' : 'cover',
                background: img.contain ? (img.backdrop ?? CONTAIN_BG) : undefined,
              }}
            />
            {img.label && <div className="g-label">{img.label}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
