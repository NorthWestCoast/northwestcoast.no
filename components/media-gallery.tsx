'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export const ALL_IMAGES = [
  { src: '/images/leider_in_use.jpg',    alt: 'Leider i bruk',               label: 'Ombordstigning fra skutesiden',    tag: 'I bruk' },
  { src: '/images/leider_m2.jpg',        alt: 'Montert fartøy',               label: 'Montert på passasjerfartøy',     tag: 'I bruk' },
  { src: '/images/praksis.jpg',          alt: 'Livbåtleider i bruk',          label: 'Livbåtleider – testdykk',        tag: 'I bruk' },
  { src: '/images/ladder-full.png',      alt: 'Full utfelling',               label: 'Full Utfelling',                 tag: 'Leider', contain: true },
  { src: '/images/ladder-folded.png',    alt: 'Foldet',                       label: 'Ultrakompakt – Foldet',          tag: 'Leider', contain: true },
  { src: '/images/leider_folded.jpg',    alt: 'Leider foldet',                label: 'Kompakt sammenfoldet',           tag: 'Leider' },
  { src: '/images/leider_cabinet.jpg',   alt: 'Oppbevaringsskap',             label: 'Oppbevaringsskap',               tag: 'Oppbevaring' },
  { src: '/images/leider_cabinet2.jpg',  alt: 'Åpen kasse',                   label: 'Innvendig lagringsskap',         tag: 'Oppbevaring' },
  { src: '/images/leiderkasse.jpg',      alt: 'Kasse ombord',                 label: 'Kompakt oppbevaring ombord',     tag: 'Oppbevaring' },
  { src: '/images/leiderkasse2.jpg',     alt: 'Argostep kasse',               label: 'Argostep kasse på dekk',         tag: 'Oppbevaring' },
  { src: '/images/leiderkasse3.jpg',     alt: 'Kasse detalj',                 label: 'Kasse – detalj',                 tag: 'Oppbevaring' },
  { src: '/images/leiderkasse4.jpg',     alt: 'Kasse på kai',                 label: 'Klar for bruk ved kai',          tag: 'Oppbevaring' },
  { src: '/images/leider_m1.jpg',        alt: 'M/S Veidar',                   label: 'Plassert ombord M/S Veidar',     tag: 'Referanser' },
  { src: '/images/tindskjaer.jpg',       alt: 'M/S Tindskjær',               label: 'M/S Tindskjær',                 tag: 'Referanser' },
  { src: '/images/ms-skar-senior.jpeg',  alt: 'M/S Skår Senior',             label: 'M/S Skår Senior',               tag: 'Referanser' },
  { src: '/images/ms-skar-senior2.jpeg', alt: 'M/S Skår Senior installasjon', label: 'Argostep på M/S Skår Senior',   tag: 'Referanser' },
  { src: '/images/ms-skar-senior3.jpeg', alt: 'M/S Skår Senior detalj',      label: 'Detalj – M/S Skår Senior',      tag: 'Referanser' },
];

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
