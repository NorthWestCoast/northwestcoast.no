import Link from 'next/link';
import { Card } from '@/components/portal/ui';
import CertificateList from '@/components/minside/certificate-list';
import { currentCertificate, loadCertificates } from '@/components/minside/service-records';
import { CERTIFICATE_NAME } from '@/lib/portal/labels';
import type { SectionProps } from './types';

/**
 * Servicesertifikatet som gjelder for leideren, på oversikten: status,
 * gyldighet, PDF og kontrollenke. Vises ikke før det første er utstedt.
 */
export default async function Sertifikat({ supabase, ladder }: Pick<SectionProps, 'supabase' | 'ladder'>) {
  const certificates = await loadCertificates(supabase, ladder.ladder_id);
  const current = currentCertificate(certificates);
  if (!current) return null;

  const earlier = certificates.length - 1;

  return (
    <Card
      title={CERTIFICATE_NAME}
      actions={
        earlier > 0 ? (
          <Link href={`/minside/leider/${ladder.ladder_id}?fane=historikk`} className="pt-link">
            Tidligere ({earlier})
          </Link>
        ) : undefined
      }
      flush
    >
      <CertificateList certificates={[current]} />
    </Card>
  );
}
