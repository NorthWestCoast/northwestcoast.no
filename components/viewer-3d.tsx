'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { Maximize2, Minimize2, Move3d, Ruler, ScanSearch } from 'lucide-react';
import { useT } from '@/components/lang-provider';

const ICONS = [Move3d, ScanSearch, Ruler];

export default function Viewer3D() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollBeforeExpand = useRef(0);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  // iOS Safari støtter ikke Fullscreen API på vanlige elementer – da legger vi
  // visningen over hele skjermen med CSS i stedet.
  const [expanded, setExpanded] = useState(false);
  const t = useT();

  const isFullscreen = nativeFullscreen || expanded;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setNativeFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Escape og låst scroll gjelder bare CSS-varianten; nettleseren håndterer
  // dette selv i ekte fullskjerm.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Dokumentet var kortere mens boksen lå utenfor flyten, så nettleseren
      // klippet scrollposisjonen. Legg den tilbake når høyden er gjenopprettet.
      const y = scrollBeforeExpand.current;
      requestAnimationFrame(() => window.scrollTo(0, y));
    };
  }, [expanded]);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }

    scrollBeforeExpand.current = window.scrollY;

    if (!el.requestFullscreen) {
      setExpanded(true);
      return;
    }

    // Fullscreen API-et kan både avvises («Permissions check failed» i en
    // iframe uten allow="fullscreen") og bli liggende og henge uten å svare.
    // Vi stoler derfor ikke på løftet, men sjekker om vi faktisk havnet i
    // fullskjerm – og legger ellers visningen over skjermen med CSS.
    const fallBackToCss = () => {
      if (document.fullscreenElement !== el) setExpanded(true);
    };

    el.addEventListener('fullscreenerror', fallBackToCss, { once: true });
    el.requestFullscreen().catch(fallBackToCss);
    window.setTimeout(() => {
      el.removeEventListener('fullscreenerror', fallBackToCss);
      fallBackToCss();
    }, 400);
  }, [expanded]);

  const infos = [t.viewer.infos.deployed, t.viewer.infos.detail, t.viewer.infos.scale];

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
        type="module"
        strategy="lazyOnload"
      />
      <section className="viewer-section" ref={sectionRef}>
        <div className="viewer-grid reveal">
          <div>
            <div className="lbl">{t.viewer.label}</div>
            <h2 className="stitle">{t.viewer.title}</h2>
            <p className="sub" style={{ marginBottom: '2rem' }}>{t.viewer.sub}</p>
            <div className="viewer-info">
              {infos.map((info, i) => (
                <div className="vinfo" key={info.title}>
                  <div className="vinfo-icon">
                    {(() => { const Icon = ICONS[i]; return <Icon size={22} strokeWidth={1.6} />; })()}
                  </div>
                  <div>
                    <strong>{info.title}</strong>
                    <p>{info.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Boksen blir liggende i flyten med samme høyde hele tiden – bare
              scenen inni løftes ut. Ellers krymper dokumentet, og nettleserens
              scroll-forankring flytter siden under føttene på deg. */}
          <div className="viewer-box">
            <div
              className={`viewer-stage${expanded ? ' is-expanded' : ''}`}
              ref={stageRef}
            >
            {/* @ts-expect-error – model-viewer is a custom web component */}
            <model-viewer
              src="/3d-models/leider-compressed-v2.glb"
              alt={t.viewer.modelAlt}
              auto-rotate
              camera-controls
              shadow-intensity="1"
              exposure="1.1"
              environment-image="neutral"
              style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0e2540 100%)', width: '100%', height: '100%' }}
              loading="eager"
              ar
            />
            <button
              type="button"
              className="viewer-fs-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t.viewer.exitFullscreen : t.viewer.fullscreen}
              title={isFullscreen ? t.viewer.exitFullscreen : t.viewer.fullscreen}
              aria-pressed={isFullscreen}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
