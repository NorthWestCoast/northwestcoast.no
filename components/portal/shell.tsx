import Link from 'next/link';
import PortalNav, { type NavGroup } from './nav';
import { signOut } from '@/lib/portal/actions';
import type { PortalContext } from '@/lib/portal/context';

const AREAS = {
  minside: { label: 'Min side', home: '/minside' },
  admin: { label: 'Admin', home: '/admin' },
  produksjon: { label: 'Produksjon', home: '/produksjon' },
} as const;

export type PortalArea = keyof typeof AREAS;

/**
 * Felles ramme for Min side, Admin og Produksjon: sidemeny på store skjermer,
 * skuff på små. Bytting mellom områdene vises bare for dem som har rollen.
 */
export default function PortalShell({
  area,
  ctx,
  groups,
  children,
}: {
  area: PortalArea;
  ctx: PortalContext;
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const others = (Object.keys(AREAS) as PortalArea[]).filter((key) => {
    if (key === area) return false;
    if (key === 'admin') return ctx.staffRole === 'admin';
    if (key === 'produksjon') return ctx.staffRole !== null;
    return true;
  });

  const role =
    ctx.staffRole === 'admin' ? 'Administrator, NorthWest Coast'
    : ctx.staffRole === 'production' ? 'Produksjon, NorthWest Coast'
    : ctx.companies.map((c) => c.name).join(', ') || 'Ingen selskap ennå';

  return (
    <div className="pt">
      <PortalNav
        area={AREAS[area].label}
        brandHref={AREAS[area].home}
        groups={groups}
        unread={ctx.unread}
        notificationsHref="/minside/varsler"
        footer={
          <>
            <div className="pt-side-user">{ctx.displayName}</div>
            <div className="pt-side-role">{role}</div>
            <div className="pt-side-links">
              {others.map((key) => (
                <Link key={key} href={AREAS[key].home}>{AREAS[key].label}</Link>
              ))}
              <Link href="/">Nettsiden</Link>
              <form action={signOut}>
                <button type="submit">Logg ut</button>
              </form>
            </div>
          </>
        }
      />
      <div className="pt-body">
        <main className="pt-main">{children}</main>
      </div>
    </div>
  );
}
