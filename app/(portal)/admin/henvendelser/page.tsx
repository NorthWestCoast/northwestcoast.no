import { requireStaff } from '@/lib/supabase/staff';
import { Alert, Badge, Card, Empty, PageHeader, Tabs, Td } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import { dato, datoTid } from '@/lib/format';
import { setRequestHandled } from './actions';

const VIEWS: Record<string, string> = {
  ubehandlet: 'Ubehandlet',
  alle: 'Alle',
};

const href = (view: string) => (view === 'ubehandlet' ? '/admin/henvendelser' : `/admin/henvendelser?vis=${view}`);

/** Kontaktskjemaet på nettsiden og påmeldte til nyhetsbrevet. */
export default async function HenvendelserPage({
  searchParams,
}: {
  searchParams: Promise<{ vis?: string }>;
}) {
  const { vis } = await searchParams;
  const view = vis && vis in VIEWS ? vis : 'ubehandlet';
  const { supabase } = await requireStaff();

  let requestQuery = supabase
    .from('contact_requests')
    .select('id, name, email, phone, company_name, product, message, source, created_at, handled_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (view === 'ubehandlet') requestQuery = requestQuery.is('handled_at', null);

  const [requests, subscriberCount, subscribers] = await Promise.all([
    requestQuery,
    supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .is('unsubscribed_at', null),
    supabase
      .from('newsletter_subscribers')
      .select('id, email, source, created_at, unsubscribed_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const readFailed = Boolean(requests.error || subscribers.error);

  return (
    <>
      <PageHeader
        title="Henvendelser"
        description="Meldinger fra kontaktskjemaet på nettsiden, og de som har meldt seg på nyhetsbrevet."
      />

      {readFailed && (
        <Alert tone="danger" title="Henvendelsene kunne ikke leses">
          Databasen ga ikke lesetilgang. Tabellene contact_requests og newsletter_subscribers mangler rettigheter
          for innloggede brukere, og det må rettes i en migrasjon før siden virker.
        </Alert>
      )}

      <Tabs current={href(view)} items={Object.entries(VIEWS).map(([key, label]) => ({ href: href(key), label }))} />

      <Card title="Kontaktskjema" flush>
        {requests.data?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Mottatt</th><th>Fra</th><th>Selskap</th><th>Produkt</th><th>Melding</th><th /></tr>
            </thead>
            <tbody>
              {requests.data.map((request) => (
                <tr key={request.id}>
                  <Td label="Mottatt">{datoTid(request.created_at)}</Td>
                  <Td label="Fra">
                    <div>
                      <strong>{request.name}</strong>
                      <div><a href={`mailto:${request.email}`}>{request.email}</a></div>
                      {request.phone && (
                        <div><a href={`tel:${request.phone.replace(/\s/g, '')}`}>{request.phone}</a></div>
                      )}
                    </div>
                  </Td>
                  <Td label="Selskap">{request.company_name ?? '–'}</Td>
                  <Td label="Produkt">{request.product ?? '–'}</Td>
                  <Td label="Melding">
                    <span style={{ whiteSpace: 'pre-line' }}>{request.message ?? '–'}</span>
                  </Td>
                  <Td>
                    {request.handled_at ? (
                      <div>
                        <Badge tone="ok">Håndtert {dato(request.handled_at)}</Badge>{' '}
                        <ActionButton
                          action={setRequestHandled}
                          fields={{ request_id: request.id, undo: 'true' }}
                          label="Åpne igjen"
                        />
                      </div>
                    ) : (
                      <ActionButton
                        action={setRequestHandled}
                        fields={{ request_id: request.id }}
                        label="Marker som håndtert"
                        tone="green"
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title={view === 'ubehandlet' ? 'Ingen ubehandlede henvendelser' : 'Ingen henvendelser ennå'} />
        )}
      </Card>

      <Card
        title="Nyhetsbrev"
        description={`${subscriberCount.count ?? 0} aktive påmeldte. Under vises de 50 siste.`}
        flush
      >
        {subscribers.data?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>E-post</th><th>Påmeldt</th><th>Kilde</th><th>Status</th></tr>
            </thead>
            <tbody>
              {subscribers.data.map((subscriber) => (
                <tr key={subscriber.id}>
                  <Td label="E-post">{subscriber.email}</Td>
                  <Td label="Påmeldt" className="pt-nowrap">{dato(subscriber.created_at)}</Td>
                  <Td label="Kilde">{subscriber.source}</Td>
                  <Td label="Status">
                    {subscriber.unsubscribed_at
                      ? <Badge>Avmeldt {dato(subscriber.unsubscribed_at)}</Badge>
                      : <Badge tone="ok">Påmeldt</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen påmeldte ennå" />
        )}
      </Card>
    </>
  );
}
