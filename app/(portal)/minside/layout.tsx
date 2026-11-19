import type { Metadata } from 'next';
import PortalShell from '@/components/portal/shell';
import type { NavGroup } from '@/components/portal/nav';
import { requireUser } from '@/lib/portal/context';

export const metadata: Metadata = {
  title: 'Min side',
  robots: { index: false, follow: false },
};

// Alt her avhenger av sesjonen; ingenting kan prerendres.
export const dynamic = 'force-dynamic';

export default async function MinSideLayout({ children }: { children: React.ReactNode }) {
  const { supabase, ctx } = await requireUser('/minside');

  // Forespørsler om tilgang som venter på at DENNE brukeren svarer.
  const { count: pendingRequests } = await supabase
    .from('ladder_access_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .neq('requester_id', ctx.userId);

  const groups: NavGroup[] = [
    {
      items: [
        { href: '/minside', label: 'Oversikt', icon: 'dashboard', exact: true },
        { href: '/minside/leidere', label: 'Leidere', icon: 'ladder' },
        { href: '/minside/fartoy', label: 'Fartøy', icon: 'vessel' },
      ],
    },
    {
      title: 'Bestilling',
      items: [
        { href: '/minside/bestill', label: 'Bestill leider og deler', icon: 'shop' },
        { href: '/minside/bestillinger', label: 'Mine bestillinger', icon: 'orders' },
        { href: '/minside/service', label: 'Service', icon: 'service' },
      ],
    },
    {
      title: 'Hjelp',
      items: [{ href: '/minside/support', label: 'Support', icon: 'support' }],
    },
    {
      title: 'Tilgang',
      items: [
        { href: '/minside/tilgang', label: 'Forespørsler', icon: 'access', count: pendingRequests ?? 0 },
        { href: '/minside/personer', label: 'Personer', icon: 'people' },
      ],
    },
    {
      title: 'Konto',
      items: [
        { href: '/minside/varsler', label: 'Varsler', icon: 'bell', count: ctx.unread },
        { href: '/minside/profil', label: 'Profil', icon: 'profile' },
      ],
    },
  ];

  return <PortalShell area="minside" ctx={ctx} groups={groups}>{children}</PortalShell>;
}
