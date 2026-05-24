'use client';

import { useEffect, useRef } from 'react';

interface WaveProps {
  top?: string;
  bottom?: string;
  // Keep these for backward compatibility with app/page.tsx, but ignore them
  path?: string;
  dual?: boolean;
  topPath?: string;
  dualTopFill?: string;
  dualBottomFill?: string;
}

export default function Wave({
  top,
  bottom,
  dualBottomFill,
}: WaveProps) {
  const wrapStyle = top ? { background: top } : undefined;
  // If dualBottomFill is provided, prefer it for the bottom wave color, otherwise fallback to bottom
  const fillColor = dualBottomFill || bottom || 'var(--sand)';

  const path0Ref = useRef<SVGPathElement>(null);
  const path1Ref = useRef<SVGPathElement>(null);
  const path2Ref = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Mouse tracking
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, active: 0 });

  useEffect(() => {
    let animationFrameId: number;
    let time = Math.random() * 1000; // Random starting phase

    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const isClose = e.clientY >= rect.top - 60 && e.clientY <= rect.bottom + 60;
      
      if (isClose) {
        // Map clientX to svg viewBox coordinates (0 to 1440)
        const scaleX = 1440 / rect.width;
        mouse.current.targetX = (e.clientX - rect.left) * scaleX;
        
        // Map clientY to svg viewBox coordinates (0 to 70)
        const scaleY = 70 / rect.height;
        mouse.current.targetY = (e.clientY - rect.top) * scaleY;
        
        mouse.current.active += 0.2;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    const getProceduralPath = (t: number, layer: number) => {
      let path = '';
      const segments = 144; // smooth curve
      const dx = 1440 / segments;
      const m = mouse.current;
      
      for(let i=0; i<=segments; i++) {
        const x = i * dx;
        let y = 35; // base level of the wave in the 70px height svg
        
        if (layer === 0) {
          y += Math.sin(x * 0.003 + t) * 12;
          y += Math.sin(x * 0.008 - t * 0.5) * 6;
        } else if (layer === 1) {
          y += Math.sin(x * 0.004 + t * 1.1 + 2) * 10;
          y += Math.sin(x * 0.007 - t * 0.4 + 1) * 7;
        } else {
          y += Math.sin(x * 0.0035 + t * 0.8 + 4) * 8;
          y += Math.sin(x * 0.009 - t * 0.7 + 3) * 5;
        }
        
        // Apply mouse interaction (only when physically close to the wave curve)
        if (m.active > 0) {
           const distanceX = Math.abs(x - m.x);
           const distanceY = Math.abs(y - m.targetY);

           if (distanceX < 100 && distanceY < 20) {
             const falloffX = Math.cos((distanceX / 100) * (Math.PI / 2));
             const falloffY = Math.cos((distanceY / 20) * (Math.PI / 2));
             const combinedFalloff = falloffX * falloffY;

             const ripple = Math.sin(distanceX * 0.08 - t * 6) * 6;
             y += ripple * combinedFalloff * m.active;
           }
        }
        
        // clamp slightly
        if (y < -20) y = -20;
        if (y > 90) y = 90;
        
        if (i === 0) path += `M0,${y}`;
        else path += ` L${x},${y}`;
      }
      
      path += ` L1440,72 L0,72Z`;
      return path;
    };

    const render = () => {
      time += 0.015; // smooth animation speed
      
      // Interpolate mouse params for smoothness
      const m = mouse.current;
      m.x += (m.targetX - m.x) * 0.1;
      m.active -= 0.02; // fade out faster
      if (m.active < 0) m.active = 0;
      if (m.active > 1) m.active = 1;

      if (path0Ref.current) path0Ref.current.setAttribute('d', getProceduralPath(time, 0));
      if (path1Ref.current) path1Ref.current.setAttribute('d', getProceduralPath(time, 1));
      if (path2Ref.current) path2Ref.current.setAttribute('d', getProceduralPath(time, 2));

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="wave" style={wrapStyle}>
      <svg ref={svgRef} viewBox="0 0 1440 70" preserveAspectRatio="none" fill="none">
        <path ref={path0Ref} fill={fillColor} opacity={0.3} style={{ transition: 'opacity 0.3s' }} />
        <path ref={path1Ref} fill={fillColor} opacity={0.6} style={{ transition: 'opacity 0.3s' }} />
        <path ref={path2Ref} fill={fillColor} opacity={1.0} style={{ transition: 'opacity 0.3s' }} />
      </svg>
    </div>
  );
}
