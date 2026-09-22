import { ImageResponse } from 'next/og';

/**
 * Genererer delingsbildet (1200×630) ved bygg.
 *
 * Hvorfor generert og ikke en fil: produktbildene i /public er portrett
 * (ladder-hero.png er 600×900), og LinkedIn/Facebook beskjærer dem stygt i
 * 1.91:1-formatet. Denne kortmalen gjelder for hele siden via Next sin
 * fil-konvensjon, så alle delte lenker får samme profil.
 */
export const alt = 'Argostep – modulær maritim leider fra NorthWest Coast';
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
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 55%, #1a3358 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: 22,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#2ecc71',
          }}
        >
          <div style={{ width: 42, height: 3, background: '#2ecc71' }} />
          NorthWest Coast
        </div>

        <div style={{ display: 'flex', fontSize: 128, fontWeight: 800, marginTop: 18 }}>
          ARGOSTEP
        </div>

        <div style={{ display: 'flex', fontSize: 36, color: 'rgba(255,255,255,0.78)', marginTop: 6 }}>
          Modulær maritim leider – bygget for norske fartøy
        </div>

        <div style={{ display: 'flex', gap: '14px', marginTop: 46 }}>
          {['ISO 799-1:2019', 'Godkjent av Sjøfartsdirektoratet', '2–15 meter'].map((badge) => (
            <div
              key={badge}
              style={{
                display: 'flex',
                padding: '12px 22px',
                fontSize: 24,
                borderRadius: 999,
                border: '1px solid rgba(46,204,113,0.55)',
                background: 'rgba(46,204,113,0.12)',
                color: '#7ee2a8',
              }}
            >
              {badge}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.45)', marginTop: 46 }}>
          northwestcoast.no · Produsert på Sunnmøre
        </div>
      </div>
    ),
    size,
  );
}
