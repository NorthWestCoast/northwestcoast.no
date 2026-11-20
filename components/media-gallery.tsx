'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLang, useT } from '@/components/lang-provider';
import { CONTAIN_BG, GALLERY_TABS, openLightbox, type GalleryItem, type ImageTag } from '@/lib/gallery-images';
import { localePath } from '@/lib/i18n';

/**
 * Bildeseksjonen på forsiden: de fire første bildene i hver kategori.
 * `images` er de faste bildene og bildene fra admin, ferdig oversatt og i
 * riktig rekkefølge (lib/gallery.ts).
 */
export default function MediaGallery({ images }: { images: GalleryItem[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState<ImageTag>('ladder');
  const lang = useLang();
  const t = useT();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const filtered = images.filter((img) => img.tag === activeTab).slice(0, 4);

  return (
    <section className="gallery" id="produkter" ref={sectionRef}>
      <div className="reveal">
        <div className="lbl lbl-dark">{t.gallery.label}</div>
        <h2 className="stitle dark">{t.gallery.title}</h2>
        <p className="sub dark">{t.gallery.sub}</p>
        <div className="gallery-tabs">
          {GALLERY_TABS.map((tab) => (
            <button
              key={tab}
              className={`tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t.gallery.tabs[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="mg-grid reveal">
        {filtered.map((img) => (
          <div
            key={img.id}
            className="mg-card"
            onClick={() => openLightbox(img.src, img.contain)}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill sizes="(max-width: 900px) 50vw, 25vw"
              unoptimized={img.unoptimized}
              style={{
                objectFit: img.contain ? 'contain' : 'cover',
                background: img.contain ? CONTAIN_BG : undefined,
              }}
            />
            {img.label && <div className="g-label">{img.label}</div>}
          </div>
        ))}
      </div>

      <div className="gallery-footer">
        <Link href={localePath(lang, '/galleri')} className="news-link">
          {t.gallery.seeAll}
        </Link>
      </div>
    </section>
  );
}
