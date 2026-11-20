import { Badge } from '@/components/portal/ui';
import { CopyField } from '@/components/portal/forms';
import { certificateStatus } from '@/lib/portal/labels';
import { dato } from '@/lib/format';
import type { Certificate } from './service-records';

/**
 * Liste over servicesertifikater: nummer, status, gyldighet, PDF og
 * kontrollenke. Brukes på oversikten og i historikken på Min side, og i
 * administrasjonen på leidersiden (der `actions` legger til «Trekk tilbake»).
 *
 * Kontrollenken kan kopieres for sertifikatet som gjelder. For de andre er
 * den en vanlig lenke: den viser da at sertifikatet er erstattet, utløpt
 * eller trukket tilbake.
 */
export default function CertificateList({
  certificates,
  plain = false,
  actions,
}: {
  certificates: Certificate[];
  /** Uten innvendig marg, når listen står inne i noe som allerede har det. */
  plain?: boolean;
  actions?: (certificate: Certificate) => React.ReactNode;
}) {
  if (certificates.length === 0) return null;

  return (
    <ul className={plain ? 'pt-list pt-list-plain' : 'pt-list'}>
      {certificates.map((certificate) => {
        const status = certificateStatus(certificate.state);
        const extra = actions?.(certificate);
        return (
          <li key={certificate.id}>
            <div className="pt-list-main">
              <strong className="pt-mono">{certificate.certificate_number}</strong>{' '}
              <Badge tone={status.tone}>{status.label}</Badge>
              <div className="pt-list-sub">
                Utstedt {dato(certificate.issued_on)} av {certificate.issued_by_name} · gyldig til{' '}
                {dato(certificate.valid_until)}
              </div>
              {certificate.state === 'revoked' && (
                <div className="pt-list-sub">
                  Trukket tilbake {dato(certificate.revoked_at)}
                  {certificate.revoked_reason ? `: ${certificate.revoked_reason}` : ''}
                </div>
              )}
              {certificate.state === 'replaced' && certificate.replacedByNumber && (
                <div className="pt-list-sub">Erstattet av {certificate.replacedByNumber}</div>
              )}
              {certificate.remarks && <div className="pt-list-sub">Merknad: {certificate.remarks}</div>}
            </div>
            <div className="pt-list-side">
              {/* Vanlig lenke, ikke klientnavigasjon: nettleseren åpner PDF-en selv. */}
              <a href={certificate.pdfUrl} target="_blank" rel="noopener noreferrer" className="pt-btn pt-btn-ghost pt-btn-sm">
                Åpne PDF
              </a>
              {certificate.state !== 'valid' && (
                <a href={certificate.verifyUrl} target="_blank" rel="noopener noreferrer" className="pt-link">
                  Kontrollside
                </a>
              )}
            </div>
            {certificate.state === 'valid' && (
              <div className="pt-list-wide">
                <CopyField value={certificate.verifyUrl} label="Kopier kontrollenke" />
                <span className="pt-hint">
                  Den som får lenken, kan kontrollere at dokumentet er ekte og fortsatt gjelder, uten å logge inn.
                </span>
              </div>
            )}
            {extra && <div className="pt-list-wide">{extra}</div>}
          </li>
        );
      })}
    </ul>
  );
}
