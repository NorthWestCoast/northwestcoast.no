'use client';

import { useState } from 'react';
import Image from 'next/image';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import Lightbox from '@/components/lightbox';
import { ALL_IMAGES } from '@/components/media-gallery';

const TABS = ['Alle', 'I bruk', 'Leider', 'Oppbevaring', 'Referanser'];

export default function GalleriPage() {
  const [activeTab, setActiveTab] = useState('Alle');

  const filtered = activeTab === 'Alle' ? ALL_IMAGES : ALL_IMAGES.filter((img) => img.tag === activeTab);

  const openLightbox = (src: string) => {
    const lb = document.getElementById('lightbox') as HTMLElement | null;
    const img = document.getElementById('lb-img') as HTMLImageElement | null;
    if (lb && img) { img.src = src; lb.classList.add('open'); }
  };

  return (
    <>
      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>Produktgalleri</div>
        <h1>Argostep i bilder</h1>
        <p>Fra produkt til praksis – se leideren fra alle vinkler og i daglig bruk langs norskekysten.</p>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      <section className="gallery" id="galleri" style={{ paddingTop: '3rem' }}>
        <div className="gallery-tabs" style={{ marginTop: 0 }}>
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

        <div className="mg-grid" style={{ marginTop: '1.5rem' }}>
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
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      <Footer />
      <Lightbox />
    </>
  );
}
