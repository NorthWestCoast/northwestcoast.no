'use client';

import { useEffect, useState } from 'react';
import { ORG } from '@/lib/site';

/**
 * Siste skanse: vises når noe feiler i nettleseren utenfor alle andre
 * feilgrenser, i stedet for Next sin engelske «Application error».
 *
 * Den vanligste årsaken er at nettstedet er rullet ut på nytt mens siden sto
 * åpen: den gamle siden klarer ikke å lese svarene fra den nye versjonen.
 * Det går over når siden lastes på nytt, så det prøver vi selv én gang først.
 * Tidsstempelet hindrer at en feil som ikke går over, laster siden i ring.
 *
 * Siden erstatter hele rotoppsettet, så den har egne <html> og <body>, og
 * stilene står her: ingen av stilarkene er lastet når den vises.
 */
const RELOADED_KEY = 'nwc_lastet_pa_nytt';
const RELOAD_WINDOW_MS = 60_000;

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [reloading, setReloading] = useState(true);

  useEffect(() => {
    console.error('[nwc] Siden kunne ikke vises:', error);
    try {
      const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
      if (Date.now() - last > RELOAD_WINDOW_MS) {
        sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
        window.location.reload();
        return;
      }
    } catch {
      // Uten lagring vet vi ikke om vi nettopp har prøvd. Da spør vi brukeren.
    }
    setReloading(false);
  }, [error]);

  return (
    <html lang="nb">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: '#f4f1ec',
          color: '#0a1628',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          lineHeight: 1.55,
        }}
      >
        {!reloading && (
          <main
            style={{
              maxWidth: '30rem',
              background: '#ffffff',
              border: '1px solid #e2dcd2',
              borderRadius: 3,
              padding: '1.75rem',
            }}
          >
            <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.375rem', fontWeight: 600 }}>
              Siden kunne ikke vises
            </h1>
            <p style={{ margin: '0 0 1.25rem' }}>
              Noe gikk galt da siden skulle lastes. Det skjer som regel når nettstedet er
              oppdatert mens siden sto åpen.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                font: 'inherit',
                fontWeight: 600,
                color: '#ffffff',
                background: '#0a1628',
                border: 0,
                borderRadius: 3,
                padding: '0.625rem 1.125rem',
                cursor: 'pointer',
              }}
            >
              Last siden på nytt
            </button>
            <p style={{ margin: '1.25rem 0 0', fontSize: '0.875rem', color: '#5b6676' }}>
              Hjelper det ikke? Ring{' '}
              <a href={`tel:${ORG.phone}`} style={{ color: 'inherit' }}>
                {ORG.phoneDisplay}
              </a>
              .
            </p>
          </main>
        )}
      </body>
    </html>
  );
}
