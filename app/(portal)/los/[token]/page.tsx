import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { Badge, Card, KV } from '@/components/portal/ui';
import Link from 'next/link';
import { CERTIFICATE_NAME, logKind, projectKind, serviceResult } from '@/lib/portal/labels';
import { BUCKETS, signedUrls } from '@/lib/portal/storage';
import { dato, datoTid } from '@/lib/format';
import PhotoGrid from '@/components/minside/photo-grid';
import PrintButton from '@/components/minside/print-button';
import { parseSharePayload } from '@/components/minside/share-payload';
import { meter } from '@/components/minside/util';

export const metadata: Metadata = {
  title: 'Tilstandsrapport for leider',
  robots: { index: false, follow: false },
};

// Hver visning telles, og rapporten kan trekkes tilbake: aldri fra cache.
export const dynamic = 'force-dynamic';

const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt">
      <div className="pt-public">
        <div className="pt-public-brand">
          <strong>NorthWest Coast</strong>
          <span className="pt-hint">Argostep · tilstandsrapport</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Shell>
      <div className="pt-card">
        <div className="pt-empty">
          <strong>{title}</strong>
          {children}
        </div>
      </div>
    </Shell>
  );
}

/**
 * Delt tilstandsrapport. Åpen for alle som har lenken, uten innlogging:
 * tokenet i adressen er nøkkelen, og databasen slår det opp via hashen.
 */
export default async function LosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!TOKEN.test(token)) {
    return <Message title="Lenken er ikke gyldig">Sjekk at du har fått med hele lenken.</Message>;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('get_ladder_share', { p_token: token });
  if (error) console.error('[los] get_ladder_share feilet:', error.message);

  const share = parseSharePayload(data);

  if (share.state === 'revoked') {
    return (
      <Message title="Lenken er trukket tilbake">
        Den som delte rapporten har stengt den. Be fartøyet om en ny lenke.
      </Message>
    );
  }
  if (share.state === 'expired') {
    return (
      <Message title="Lenken er utløpt">
        Rapporten viste tilstanden på et bestemt tidspunkt og er ikke lenger tilgjengelig. Be fartøyet om en ny lenke.
      </Message>
    );
  }
  if (share.state !== 'active') {
    return <Message title="Lenken er ikke gyldig">Sjekk at du har fått med hele lenken, eller be fartøyet om en ny.</Message>;
  }

  // Lagringen slipper bildene gjennom så lenge delingen er aktiv.
  const urls = await signedUrls(supabase, BUCKETS.shares, share.photos.map((photo) => photo.path));
  const photos = share.photos.flatMap((photo, index) => {
    const url = urls.get(photo.path);
    return url
      ? [{
          key: photo.path,
          url,
          alt: photo.caption ?? `Bilde ${index + 1} av leideren`,
          caption: photo.capturedAt ? `Tatt ${datoTid(photo.capturedAt)}` : null,
        }]
      : [];
  });

  const { ladder, vessel, project, certificate, lastService } = share;
  const result = lastService ? serviceResult(lastService.result) : null;

  return (
    <Shell>
      <div className="pt-header">
        <div>
          <div className="pt-header-title">
            <h1>{share.title ?? 'Tilstandsrapport'}</h1>
          </div>
          <p>
            {[
              vessel?.name ?? project?.name,
              ladder.serialNumber ? `leider ${ladder.serialNumber}` : null,
              share.recipient ? `til ${share.recipient}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="pt-actions"><PrintButton /></div>
      </div>

      {vessel && (
        <Card title="Fartøy">
          <KV
            items={[
              { label: 'Navn', value: vessel.name },
              { label: 'IMO', value: vessel.imo },
              { label: 'Kallesignal', value: vessel.callSign },
            ]}
          />
        </Card>
      )}

      {project && (
        <Card title="Sted">
          <KV
            items={[
              { label: 'Navn', value: project.name },
              { label: 'Type', value: projectKind(project.kind).label },
              { label: 'Sted', value: project.location },
            ]}
          />
        </Card>
      )}

      <Card
        title="Leider"
        footer="Sertifisert etter ISO 799-1:2019 · Godkjent av Sjøfartsdirektoratet"
      >
        <KV
          items={[
            { label: 'Produksjonsnr.', value: ladder.serialNumber },
            { label: 'Produkt', value: ladder.productName },
            { label: 'Produktnr.', value: ladder.productNumber },
            { label: 'Lengde', value: meter(ladder.lengthM) },
            { label: 'Trinn', value: ladder.steps },
            { label: 'Produsert', value: dato(ladder.producedAt) },
            { label: 'Montert', value: dato(ladder.installedAt) },
          ]}
        />
      </Card>

      <Card title="Siste service">
        {lastService && result ? (
          <KV
            items={[
              { label: 'Dato', value: dato(lastService.performedAt) },
              { label: 'Resultat', value: <Badge tone={result.tone}>{result.label}</Badge> },
              { label: 'Utført av', value: lastService.performedBy },
              { label: 'Neste frist', value: dato(lastService.nextServiceDue) },
            ]}
          />
        ) : (
          <p className="pt-hint">Det er ikke registrert service på leideren ennå.</p>
        )}
      </Card>

      {certificate && (
        <Card
          title={CERTIFICATE_NAME}
          description="Utstedt av NorthWest Coast etter service. Lenken viser om det fortsatt gjelder."
        >
          <KV
            items={[
              { label: 'Nummer', value: certificate.number },
              { label: 'Utstedt', value: dato(certificate.issuedOn) },
              {
                label: 'Gyldig til',
                value: (
                  <>
                    {dato(certificate.validUntil)}{' '}
                    <Badge tone={certificate.expired ? 'danger' : 'ok'}>
                      {certificate.expired ? 'Utløpt' : 'Gyldig'}
                    </Badge>
                  </>
                ),
              },
              {
                label: 'Kontroll',
                value: certificate.verifyToken ? (
                  <Link href={`/sertifikat/${certificate.verifyToken}`}>Kontroller dokumentet</Link>
                ) : null,
              },
            ]}
          />
        </Card>
      )}

      {share.checklist.length > 0 && (
        <Card title="Kontrollert av mannskapet" flush>
          <ul className="pt-list">
            {share.checklist.map((item) => (
              <li key={item.label}>
                <div className="pt-list-main">{item.label}</div>
                <div className="pt-list-side">
                  <Badge tone={item.checked ? 'ok' : 'neutral'}>{item.checked ? 'Bekreftet' : 'Ikke bekreftet'}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {share.note && (
        <Card title="Kommentar fra fartøyet">
          <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{share.note}</p>
        </Card>
      )}

      <Card title="Bilder" description="Tidspunktet viser når hvert bilde ble tatt.">
        {photos.length > 0 ? (
          <PhotoGrid photos={photos} large />
        ) : (
          <p className="pt-hint">Det er ikke lagt ved bilder i rapporten.</p>
        )}
      </Card>

      {share.recentLogs.length > 0 && (
        <Card title="Siste loggføringer" flush>
          <ul className="pt-list">
            {share.recentLogs.map((log, index) => (
              <li key={`${log.performedAt}-${index}`}>
                <div className="pt-list-main">
                  <strong>{log.title ?? logKind(log.kind)}</strong>
                  <div className="pt-list-sub">
                    {[log.title ? logKind(log.kind) : null, log.reporterName].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="pt-list-side">{dato(log.performedAt)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="pt-hint">
        Rapporten er opprettet {datoTid(share.createdAt)}
        {share.createdByName ? ` av ${share.createdByName}` : ''} og er tilgjengelig til {datoTid(share.expiresAt)}.
        Opplysningene er registrert av {vessel ? 'fartøyet' : 'eieren'} og NorthWest Coast AS.
      </p>
    </Shell>
  );
}
