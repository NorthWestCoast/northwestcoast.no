'use client';

import { useEffect, useRef } from 'react';

const FEATURES = [
  {
    icon: '🖐',
    title: 'Enkel Håndtering',
    desc: 'Betydelig lettere enn treleidere. Klikk-kobling gjør utsetting og innhenting raskt.',
  },
  {
    icon: '📦',
    title: 'Kompakt Lagring',
    desc: 'Lagres i eget værbestandig skap – beskytt mot slitasje, spar dekksplass.',
  },
  {
    icon: '⏳',
    title: 'Lang Levetid',
    desc: 'Utskiftbare komponenter av armert plast – bytt ett trinn, ikke hele leideren.',
  },
  {
    icon: '✂️',
    title: 'Skreddersydd',
    desc: 'Tilpasset dine spesifikasjoner. Fleksibel løsning fra 2 til 15 meter.',
  },
];

export default function Features() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    const el = ref.current;
    if (el) {
      el.querySelectorAll('.reveal').forEach((item) => observer.observe(item));
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="features" ref={ref}>
      {FEATURES.map((f, i) => (
        <div
          className="feat reveal"
          key={f.title}
          style={{ transitionDelay: `${i * 0.1}s` }}
        >
          <div className="feat-icon">{f.icon}</div>
          <h3>{f.title}</h3>
          <p>{f.desc}</p>
        </div>
      ))}
    </div>
  );
}
