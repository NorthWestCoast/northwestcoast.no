import { ImageResponse } from 'next/og';
import { getDict, isLang } from '@/lib/i18n';

// Delt forhåndsvisningsbilde for sosiale medier og søk (1200×630).
export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  // Bare språkene vi har: ellers kunne hvem som helst få tegnet et nytt bilde
  // for hver adresse de fant på.
  if (!isLang(lang)) return new Response('Not found', { status: 404 });
  const t = getDict(lang);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0a1628',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          borderBottom: '10px solid #2ecc71',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 6, color: '#2ecc71' }}>
          NORTHWEST COAST
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 132, fontWeight: 800, lineHeight: 1 }}>
            <span>ARGO</span>
            <span style={{ color: '#2ecc71' }}>STEP</span>
          </div>
          <div style={{ display: 'flex', fontSize: 40, marginTop: 28, color: 'rgba(255,255,255,0.8)', maxWidth: 900 }}>
            {t.meta.home.ogDescription}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.6)' }}>
          ISO 799-1:2019 · 2–15 m · northwestcoast.no
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
