'use client';

import { useEffect, useRef } from 'react';
import { Feather, Package, Shield, SlidersHorizontal } from 'lucide-react';

const FEATURES = [
  {
    Icon: Feather,
    title: 'Enkel Håndtering',
    desc: 'Betydelig lettere enn treleidere. Klikk-kobling gjør utsetting og innhenting raskt.',
  },
  {
    Icon: Package,
    title: 'Kompakt Lagring',
    desc: 'Lagres i eget værbestandig skap – beskytt mot slitasje, spar dekksplass.',
  },
  {
    Icon: Shield,
    title: 'Lang Levetid',
    desc: 'Utskiftbare komponenter av armert plast – bytt ett trinn, ikke hele leideren.',
  },
  {
    Icon: SlidersHorizontal,
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
          <div className="feat-icon">
            <f.Icon size={30} strokeWidth={1.5} />
          </div>
          <h3>{f.title}</h3>
          <p>{f.desc}</p>
        </div>
      ))}
    </div>
  );
}
