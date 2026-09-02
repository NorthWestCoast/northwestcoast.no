'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

const PHOTOS = [
  { src: '/images/leider_in_use.jpg',   alt: 'Leider i bruk',           cap: 'Ombordstigning fra skutesiden' },
  { src: '/images/leiderkasse.jpg',     alt: 'Kasse ombord',            cap: 'Kompakt oppbevaring ombord' },
  { src: '/images/leiderkasse2.jpg',    alt: 'Argostep kasse',          cap: 'Argostep kasse på dekk' },
  { src: '/images/leider_cabinet.jpg',  alt: 'Åpen kasse',              cap: 'Innvendig lagringsskap' },
  { src: '/images/leider_m2.jpg',       alt: 'Montert fartøy',          cap: 'Montert på passasjerfartøy' },
  { src: '/images/leiderkasse4.jpg',    alt: 'Kasse på kai',            cap: 'Klar for bruk ved kai' },
  { src: '/images/praksis.jpg',         alt: 'Livbåtleider i bruk',     cap: 'Livbåtleider – testdykk' },
  { src: '/images/leider_m1.jpg',       alt: 'M/S Veidar',              cap: 'Plassert ombord M/S Veidar' },
];

export default function InUse() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="inuse" ref={sectionRef}>
      <div className="inuse-header reveal">
        <div className="lbl lbl-dark">Praksis</div>
        <h2 className="stitle dark">Argostep i felten</h2>
        <p className="sub dark">
          Fra norske farvann – leideren i daglig bruk ombord på fartøy langs kysten.
        </p>
      </div>

      <div className="photostrip reveal">
        {PHOTOS.map((photo) => (
          <div className="photo-card" key={photo.src}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 700px) 50vw, 25vw"
              style={{ objectFit: 'cover' }}
            />
            <div className="photo-cap">{photo.cap}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
