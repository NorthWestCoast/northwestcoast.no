import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import ServiceBadge from '@/components/minside/service-badge';
import { dato } from '@/lib/format';

/**
 * Oversikt.
 *
 * Rekkefølgen er bevisst: det som haster først. En forfalt service er et
 * avvik ved tilsyn, ikke en detalj nederst på siden.
 */
export default async function MinSidePage() {
  const supabase = await createServerSupabase();

  const [{ data: companies }, { data: ladders }, { data: maintenance }] = await Promise.all([
    supabase.from('companies').select('id, name'),
    supabase
      .from('ladder_status')
      .select('ladder_id, serial_number, product_name, vessel_id, vessel_name, next_service_due, days_until_service, service_state')
      .order('days_until_service', { ascending: true, nullsFirst: false }),
    supabase
      .from('maintenance_logs')
      .select('id, performed_at, reporter_name, serial_number_raw, vessel_name_raw')
      .order('performed_at', { ascending: false })
      .limit(5),
  ]);

  // Ingen tilknytning ennå – vanligvis en invitasjon som ikke er sendt, eller
  // et fartøy som ikke er registrert. Bedre å si det enn å vise tomme tall.
  if (!companies?.length) {
    return (
      <div className="ms-empty-state">
        <h1>Velkommen</h1>
        <p>
          Kontoen din er ikke knyttet til et rederi ennå. Det skjer så snart
          NorthWest Coast har registrert fartøyet og leideren deres.
        </p>
        <p>
          Har det gått for lang tid?{' '}
          <a href="mailto:arve@astep.no">Send oss en e-post</a> eller ring{' '}
          <a href="tel:+4790407341">+47 904 07 341</a>.
        </p>
      </div>
    );
  }

  const needsAttention = (ladders ?? []).filter(
    (l) => l.service_state === 'overdue' || l.service_state === 'due_soon',
  );
  const overdue = needsAttention.filter((l) => l.service_state === 'overdue').length;

  // Grupper leiderne per fartøy for oversiktskortene.
  const byVessel = new Map<string, typeof ladders>();
  for (const ladder of ladders ?? []) {
    if (!ladder.vessel_id) continue;
    const list = byVessel.get(ladder.vessel_id) ?? [];
    list.push(ladder);
    byVessel.set(ladder.vessel_id, list);
  }

  return (
    <>
      <h1>{companies.map((c) => c.name).join(', ')}</h1>

      {needsAttention.length > 0 ? (
        <section className={`ms-alert ${overdue > 0 ? 'ms-alert-red' : 'ms-alert-amber'}`}>
          <h2>
            {overdue > 0
              ? `${overdue} leider(e) har forfalt service`
              : `${needsAttention.length} leider(e) nærmer seg service`}
          </h2>
          <ul>
            {needsAttention.slice(0, 5).map((l) => (
              <li key={l.ladder_id}>
                <Link href={`/minside/leider/${l.ladder_id}`}>{l.serial_number}</Link>
                {l.vessel_name ? ` · ${l.vessel_name}` : ''} · frist {dato(l.next_service_due)}
                <ServiceBadge state={l.service_state} days={l.days_until_service} />
              </li>
            ))}
          </ul>
          <p className="ms-alert-foot">
            Trenger dere service? Ring <a href="tel:+4790407341">+47 904 07 341</a> eller{' '}
            <a href="mailto:arve@astep.no">send en e-post</a>.
          </p>
        </section>
      ) : (
        <section className="ms-alert ms-alert-green">
          <h2>All service er à jour</h2>
          <p className="ms-alert-foot">Ingen leidere har forfallende service.</p>
        </section>
      )}

      <section className="ms-section">
        <h2>Fartøy</h2>
        {byVessel.size > 0 ? (
          <div className="ms-cards">
            {[...byVessel.entries()].map(([vesselId, list]) => {
              const vesselName = list?.[0]?.vessel_name ?? 'Ukjent fartøy';
              const worst =
                list?.find((l) => l.service_state === 'overdue') ??
                list?.find((l) => l.service_state === 'due_soon') ??
                list?.[0];
              return (
                <Link key={vesselId} href={`/minside/fartoy/${vesselId}`} className="ms-card">
                  <h3>{vesselName}</h3>
                  <p>{list?.length ?? 0} leider(e)</p>
                  <ServiceBadge
                    state={worst?.service_state ?? null}
                    days={worst?.days_until_service}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="ms-muted">
            Ingen fartøy registrert ennå. Ta kontakt, så legger vi dem inn.
          </p>
        )}
      </section>

      <section className="ms-section">
        <h2>Siste vedlikehold</h2>
        {maintenance?.length ? (
          <table className="ms-table">
            <thead><tr><th>Dato</th><th>Leider</th><th>Fartøy</th><th>Utført av</th></tr></thead>
            <tbody>
              {maintenance.map((m) => (
                <tr key={m.id}>
                  <td>{dato(m.performed_at)}</td>
                  <td>{m.serial_number_raw ?? '–'}</td>
                  <td>{m.vessel_name_raw ?? '–'}</td>
                  <td>{m.reporter_name ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ms-muted">
            Ingen vedlikehold registrert. Registrer det på{' '}
            <Link href="/vedlikehold">vedlikeholdssiden</Link>.
          </p>
        )}
      </section>
    </>
  );
}
