import Link from 'next/link';
import { siteHref } from '@/lib/site';
import PortalNav, { type NavGroup } from './nav';
import { signOut } from '@/lib/portal/actions';
import type { PortalContext, StaffRole } from '@/lib/portal/context';
import { MEDIA_HOME } from '@/lib/portal/landing';
import { staffRoleLabel } from '@/lib/portal/labels';

type Area = { label: string; home: string };

const AREAS = {
  minside: { label: 'Min side', home: '/minside' },
  admin: { label: 'Admin', home: '/admin' },
  produksjon: { label: 'Produksjon', home: '/produksjon' },
} as const satisfies Record<string, Area>;

export type PortalArea = keyof typeof AREAS;

/**
 * Områdene en rolle har tilgang til, slik de skal hete og hvor de starter.
 * Medierollen ser bare nyheter og galleri i admin-området, så for dem heter
 * det «Media» og starter på nyhetene. Produksjon er ikke med for dem.
 */
function areasFor(role: StaffRole): Partial<Record<PortalArea, Area>> {
  if (role === 'admin') return AREAS;
  if (role === 'production') return { minside: AREAS.minside, produksjon: AREAS.produksjon };
  if (role === 'media') return { minside: AREAS.minside, admin: { label: 'Media', home: MEDIA_HOME } };
  return { minside: AREAS.minside };
}

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
  const areas = areasFor(ctx.staffRole);
  const current = areas[area] ?? AREAS[area];
  const others = (Object.keys(AREAS) as PortalArea[])
    .filter((key) => key !== area)
    .flatMap((key) => areas[key] ?? []);

  const role = ctx.staffRole
    ? `${staffRoleLabel(ctx.staffRole).label}, NorthWest Coast`
    : ctx.companies.map((c) => c.name).join(', ') || 'Ingen selskap ennå';

  return (
    <div className="pt">
      <PortalNav
        area={current.label}
        brandHref={current.home}
        groups={groups}
        unread={ctx.unread}
        notificationsHref="/minside/varsler"
        footer={
          <>
            <div className="pt-side-user">{ctx.displayName}</div>
            <div className="pt-side-role">{role}</div>
            <div className="pt-side-links">
              {others.map((other) => (
                <Link key={other.home} href={other.home}>{other.label}</Link>
              ))}
              <Link href={siteHref('/')}>Nettsiden</Link>
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
