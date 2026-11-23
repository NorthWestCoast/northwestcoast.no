import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { Alert, Badge, Card, KV } from '@/components/portal/ui';
import {
  CERTIFICATE_NAME, CERTIFICATE_NAME_LOWER, type CertificateState, type Tone, certificateStatus, serviceResult,
} from '@/lib/portal/labels';
import { ORG } from '@/lib/site';
import { dato, datoTid } from '@/lib/format';
import PrintButton from '@/components/minside/print-button';
import { meter } from '@/components/minside/util';

export const metadata: Metadata = {
  title: `Kontroll av ${CERTIFICATE_NAME_LOWER}`,
  robots: { index: false, follow: false },
};

// Statusen kan endre seg (utløpt, erstattet, trukket tilbake): aldri fra cache.
export const dynamic = 'force-dynamic';

const TOKEN = /^[a-f0-9]{32}$/;

type Verified = {
  number: string;
  state: CertificateState;
  issuedOn: string;
  validUntil: string;
  issuedByName: string | null;
  result: string | null;
  serialNumber: string | null;
  productName: string | null;
  lengthM: number | null;
  companyName: string | null;
  vesselName: string | null;
  projectName: string | null;
};

const str = (value: unknown) => (typeof value === 'string' && value ? value : null);

/** Leser svaret fra get_certificate(). Alt som ikke ser riktig ut, regnes som «fant ikke». */
function parse(data: unknown): Verified | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (row.found !== true) return null;

  const number = str(row.certificate_number);
  const issuedOn = str(row.issued_on);
  const validUntil = str(row.valid_until);
  const state = row.status;
  if (!number || !issuedOn || !validUntil) return null;
  if (state !== 'valid' && state !== 'expired' && state !== 'replaced' && state !== 'revoked') return null;

  return {
    number,
    state,
    issuedOn,
    validUntil,
    issuedByName: str(row.issued_by_name),
    result: str(row.result),
    serialNumber: str(row.serial_number),
    productName: str(row.product_name),
    lengthM: typeof row.length_m === 'number' ? row.length_m : null,
    companyName: str(row.company_name),
    vesselName: str(row.vessel_name),
    projectName: str(row.project_name),
  };
}

/** Det den som kontrollerer trenger å vite først: gjelder dokumentet eller ikke. */
function verdict(certificate: Verified): { tone: Exclude<Tone, 'neutral'>; title: string; text: string } {
  switch (certificate.state) {
    case 'valid':
      return {
        tone: 'ok',
        title: `Gyldig til ${dato(certificate.validUntil)}`,
        text: `Dokumentet er utstedt av ${ORG.name} og gjelder for leideren under.`,
      };
    case 'expired':
      return {
        tone: 'danger',
        title: `Utløpt ${dato(certificate.validUntil)}`,
        text: 'Dokumentet er ekte, men gyldigheten er gått ut. Leideren må til ny service.',
      };
    case 'replaced':
      return {
        tone: 'warn',
        title: 'Erstattet av et nyere',
        text: 'Dokumentet er ekte, men gjelder ikke lenger. Be eieren om det nyeste.',
      };
    default:
      return {
        tone: 'danger',
        title: 'Trukket tilbake',
        text: `Dokumentet er trukket tilbake av ${ORG.name} og gjelder ikke.`,
      };
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt">
      <div className="pt-public">
        <div className="pt-public-brand">
          <strong>NorthWestCoast</strong>
          <span className="pt-hint">Argostep · {CERTIFICATE_NAME_LOWER}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <Shell>
      <div className="pt-card">
        <div className="pt-empty">
          <strong>Fant ikke dokumentet</strong>
          Adressen hører ikke til noe {CERTIFICATE_NAME_LOWER} fra {ORG.name}. Sjekk at du har fått med hele adressen,
          eller ta kontakt på {ORG.phoneDisplay}.
        </div>
      </div>
    </Shell>
  );
}

/**
 * Kontroll av et servicesertifikat. Åpen for alle som har lenken, uten
 * innlogging: koden i adressen står på sertifikatet, og databasen svarer
 * bare med det som står på selve dokumentet.
 */
export default async function SertifikatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) return <NotFound />;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('get_certificate', { p_token: token });
  if (error) console.error('[sertifikat] get_certificate feilet:', error.message);

  const certificate = parse(data);
  if (!certificate) return <NotFound />;

  const status = certificateStatus(certificate.state);
  const outcome = verdict(certificate);
  const result = certificate.result ? serviceResult(certificate.result) : null;

  return (
    <Shell>
      <div className="pt-header">
        <div>
          <div className="pt-header-title">
            <h1>{CERTIFICATE_NAME} {certificate.number}</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p>
            {[
              certificate.serialNumber ? `Leider ${certificate.serialNumber}` : null,
              certificate.vesselName ?? certificate.projectName ?? certificate.companyName,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="pt-actions"><PrintButton /></div>
      </div>

      <Alert tone={outcome.tone} title={outcome.title}>{outcome.text}</Alert>

      <Card title="Leider">
        <KV
          items={[
            { label: 'Produksjonsnr.', value: certificate.serialNumber },
            { label: 'Produkt', value: certificate.productName },
            { label: 'Lengde', value: meter(certificate.lengthM) },
          ]}
        />
      </Card>

      <Card title="Eier og plassering" description="Slik det var registrert da dokumentet ble utstedt.">
        <KV
          items={[
            { label: 'Eier', value: certificate.companyName },
            { label: 'Fartøy', value: certificate.vesselName },
            ...(certificate.projectName ? [{ label: 'Prosjekt', value: certificate.projectName }] : []),
          ]}
        />
      </Card>

      <Card title="Service og gyldighet">
        <KV
          items={[
            { label: 'Resultat av service', value: result ? <Badge tone={result.tone}>{result.label}</Badge> : null },
            { label: 'Utstedt', value: dato(certificate.issuedOn) },
            { label: 'Gyldig til', value: dato(certificate.validUntil) },
            { label: 'Utstedt av', value: certificate.issuedByName },
          ]}
        />
      </Card>

      <p className="pt-hint">
        Hentet fra registeret til {ORG.name} {datoTid(new Date().toISOString())}. Dokumentet bekrefter service utført
        av {ORG.name}. Det er ikke en godkjenning fra offentlige myndigheter.
      </p>
    </Shell>
  );
}
