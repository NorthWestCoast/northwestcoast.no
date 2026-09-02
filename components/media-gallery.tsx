'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ALL_IMAGES } from '@/lib/gallery';

const TABS = ['Leider', 'Oppbevaring', 'I bruk', 'Referanser'];

export default function MediaGallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState('Leider');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const filtered = ALL_IMAGES.filter((img) => img.tag === activeTab).slice(0, 4);

  const openLightbox = (src: string) => {
    const lb = document.getElementById('lightbox') as HTMLElement | null;
    const img = document.getElementById('lb-img') as HTMLImageElement | null;
    if (lb && img) { img.src = src; lb.classList.add('open'); }
  };

  return (
    <section className="gallery" id="produkter" ref={sectionRef}>
      <div className="reveal">
        <div className="lbl lbl-dark">Produktgalleri</div>
        <h2 className="stitle dark">Argostep i bilder</h2>
        <p className="sub dark">
          Fra produkt til praksis – se Argostep fra alle vinkler og i daglig bruk langs norskekysten.
        </p>
        <div className="gallery-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mg-grid reveal">
        {filtered.map((img) => (
          <div
            key={img.src}
            className="mg-card"
            onClick={() => openLightbox(img.src)}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              style={{
                objectFit: img.contain ? 'contain' : 'cover',
                background: img.contain ? '#e8e0d4' : undefined,
              }}
            />
            <div className="g-label">{img.label}</div>
          </div>
        ))}
      </div>

      <div className="gallery-footer">
        <a href="/galleri" className="news-link">Se alle bilder →</a>
      </div>
    </section>
  );
}
