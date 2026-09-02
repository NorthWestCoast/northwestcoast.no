import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/site';

/**
 * Default social / answer-engine preview card.
 *
 * Generated with next/og at build time (no extra dependency, no design tool in
 * the loop). Every page inherits it unless it declares its own, so links shared
 * in Slack, LinkedIn, iMessage — and the thumbnails some AI search results now
 * render — stop showing a blank rectangle.
 */

export const alt = 'Argostep – maritim leider fra NorthWest Coast';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          // Matches --navy / --navy-mid in globals.css.
          background: 'linear-gradient(135deg, #0a1628 0%, #0e2540 60%, #123055 100%)',
          padding: '72px 80px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 3, background: '#2ecc71' }} />
          <div
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#2ecc71',
            }}
          >
            NorthWest Coast
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 108, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            ARGOSTEP
          </div>
          <div style={{ fontSize: 36, color: '#b9c7d8', maxWidth: 900, lineHeight: 1.35 }}>
            Lett, modulær maritim leider – ISO 799-1:2019 og godkjent av Sjøfartsdirektoratet
          </div>
        </div>

        <div style={{ display: 'flex', gap: 48, fontSize: 26, color: '#8fa3b8' }}>
          <div style={{ display: 'flex' }}>3–15 meter</div>
          <div style={{ display: 'flex' }}>Norsk produksjon</div>
          <div style={{ display: 'flex' }}>{SITE.phoneDisplay}</div>
        </div>
      </div>
    ),
    size,
  );
}
