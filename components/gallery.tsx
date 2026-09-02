'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

const ALL_IMAGES = [
  { src: '/images/leider_in_use.jpg',   alt: 'Argostep i bruk',       label: 'Leider i bruk',          tag: 'I bruk' },
  { src: '/images/ladder-full.png',     alt: 'Full utfelling',         label: 'Full Utfelling',          tag: 'Leider', contain: true },
  { src: '/images/ladder-folded.png',   alt: 'Foldet',                 label: 'Ultrakompakt – Foldet',   tag: 'Leider', contain: true },
  { src: '/images/leider_cabinet.jpg',  alt: 'Oppbevaringsskap',       label: 'Oppbevaringsskap',        tag: 'Oppbevaring' },
  { src: '/images/leider_m1.jpg',       alt: 'Ombord',                 label: 'Montert ombord',          tag: 'I bruk' },
];

const TABS = ['Alle', 'Leider', 'Oppbevaring', 'I bruk'];

export default function Gallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState('Alle');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const filtered = activeTab === 'Alle' ? ALL_IMAGES : ALL_IMAGES.filter((img) => img.tag === activeTab);

  const openLightbox = (src: string) => {
    const lb = document.getElementById('lightbox') as HTMLElement | null;
    const img = document.getElementById('lb-img') as HTMLImageElement | null;
    if (lb && img) { img.src = src; lb.classList.add('open'); }
  };

  return (
    <section className="gallery" id="produkter" ref={sectionRef}>
      <div className="reveal">
        <div className="lbl lbl-dark">Produktgalleri</div>
        <h2 className="stitle dark">Se Argostep fra alle vinkler</h2>
        <p className="sub dark">Klikk på bildene for å forstørre.</p>
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

      <div className="gallery-main reveal">
        {filtered.map((img) => (
          <div
            key={img.src}
            className="g-card"
            onClick={() => openLightbox(img.src)}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              style={{ objectFit: img.contain ? 'contain' : 'cover', background: img.contain ? '#e8e0d4' : undefined }}
            />
            <div className="g-label">{img.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
