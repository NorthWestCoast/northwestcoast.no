'use client';

import { useEffect, useRef } from 'react';
import { Feather, Package, Shield, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/components/lang-provider';

const ICONS = [Feather, Package, Shield, SlidersHorizontal];

export default function Features() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  const features = [
    t.features.handling,
    t.features.storage,
    t.features.lifetime,
    t.features.custom,
  ];

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
      {features.map((f, i) => {
        const Icon = ICONS[i];
        return (
          <div
            className="feat reveal"
            key={f.title}
            style={{ transitionDelay: `${i * 0.1}s` }}
          >
            <div className="feat-icon">
              <Icon size={30} strokeWidth={1.5} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
