'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useT } from '@/components/lang-provider';
import { CONTAIN_BG, GALLERY_IMAGES, openLightbox, type ImageTag } from '@/lib/images';

type Tab = ImageTag | 'all';

const TABS: Tab[] = ['all', 'inUse', 'ladder', 'storage', 'references'];

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const t = useT();

  const filtered =
    activeTab === 'all' ? GALLERY_IMAGES : GALLERY_IMAGES.filter((img) => img.tag === activeTab);

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
            key={img.src}
            className="mg-card"
            onClick={() => openLightbox(img.src, img.contain)}
          >
            <Image
              src={img.src}
              alt={t.gallery.images[img.key].alt}
              fill sizes="(max-width: 900px) 50vw, 25vw"
              style={{
                objectFit: img.contain ? 'contain' : 'cover',
                background: img.contain ? CONTAIN_BG : undefined,
              }}
            />
            <div className="g-label">{t.gallery.images[img.key].label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
