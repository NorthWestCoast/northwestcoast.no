import Link from 'next/link';
import { requireProduction } from '@/lib/portal/context';
import { jobStatus } from '@/lib/portal/labels';
import { Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { JobKindBadge, datoOslo, specLine } from '@/components/produksjon/job';

/** Jobber som har forlatt produksjonen: sendt, levert eller kansellert. */
export default async function FerdigeJobberPage() {
  const { supabase } = await requireProduction('/produksjon/ferdige');

  const { data: jobs, error } = await supabase
    .from('production_jobs')
    .select(
      'id, job_number, kind, status, product_name, product_number, length_m, steps, with_cabinet, customer_label, vessel_name, serial_number, shipped_at, delivered_at',
    )
    .in('status', ['shipped', 'delivered', 'cancelled'])
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) console.error('[produksjon] Kunne ikke hente ferdige jobber:', error.message);

  return (
    <>
      <PageHeader
        title="Sendt og levert"
        description="Jobber som er sendt, levert eller kansellert. De nyeste står øverst."
        crumbs={[{ href: '/produksjon', label: 'Tavle' }, { label: 'Sendt og levert' }]}
      />

      <Card flush>
        {jobs?.length ? (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Jobb</th>
                <th>Produkt</th>
                <th>Kunde</th>
                <th>Produksjonsnummer</th>
                <th>Sendt</th>
                <th>Levert</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const status = jobStatus(job.status);
                return (
                  <tr key={job.id}>
                    <Td label="Jobb" className="pt-table-strong pt-nowrap">
                      <Link href={`/produksjon/${job.id}`}>{job.job_number}</Link>
                    </Td>
                    <Td label="Produkt">
                      <div>
                        {job.product_name} <JobKindBadge job={job} />
                        <div className="pt-muted">{specLine(job)}</div>
                      </div>
                    </Td>
                    <Td label="Kunde">
                      <div>
                        {job.customer_label ?? '–'}
                        {job.vessel_name && <div className="pt-muted">{job.vessel_name}</div>}
                      </div>
                    </Td>
                    <Td label="Produksjonsnummer">
                      {job.serial_number ? <span className="pt-mono">{job.serial_number}</span> : '–'}
                    </Td>
                    <Td label="Sendt" className="pt-nowrap">{datoOslo(job.shipped_at)}</Td>
                    <Td label="Levert" className="pt-nowrap">{datoOslo(job.delivered_at)}</Td>
                    <Td label="Status"><Badge tone={status.tone}>{status.label}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title={error ? 'Jobbene kunne ikke hentes' : 'Ingen sendte eller leverte jobber ennå'}>
            {error
              ? 'Last siden på nytt. Gi beskjed til en administrator hvis det fortsetter.'
              : 'Jobber havner her når de er markert som sendt på tavla.'}
          </Empty>
        )}
      </Card>
    </>
  );
}
