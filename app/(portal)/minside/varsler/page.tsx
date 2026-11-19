import Link from 'next/link';
import { requireUser } from '@/lib/portal/context';
import { markNotificationsRead } from '@/lib/portal/actions';
import { Card, Empty, PageHeader, Badge } from '@/components/portal/ui';
import { datoTid } from '@/lib/format';

/**
 * Varsler: alt som har skjedd som angår brukeren (tilgang, bestilling,
 * service, svar på saker). Gjelder både kunder og ansatte.
 */
export default async function VarslerPage() {
  const { supabase, ctx } = await requireUser('/minside/varsler');

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, link, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Varsler"
        description="Tilgang, bestillinger, service og svar på saker samles her."
        actions={
          ctx.unread > 0 && (
            <form action={markNotificationsRead}>
              <button type="submit" className="pt-btn pt-btn-ghost">Merk alle som lest</button>
            </form>
          )
        }
      />

      <Card flush>
        {notifications?.length ? (
          <ul className="pt-list">
            {notifications.map((n) => (
              <li key={n.id}>
                <div className="pt-list-main">
                  {n.link ? <Link href={n.link}>{n.title}</Link> : <strong>{n.title}</strong>}
                  {n.body && <div className="pt-list-sub">{n.body}</div>}
                  <div className="pt-list-sub">{datoTid(n.created_at)}</div>
                </div>
                <div className="pt-list-side">
                  {!n.read_at && (
                    <>
                      <Badge tone="info">Ny</Badge>
                      <form action={markNotificationsRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" className="pt-link">Merk som lest</button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Ingen varsler ennå">
            Du får beskjed her når noe skjer med leiderne, bestillingene eller sakene dine.
          </Empty>
        )}
      </Card>
    </>
  );
}
