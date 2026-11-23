import type { Metadata } from 'next';
import PortalShell from '@/components/portal/shell';
import type { NavGroup } from '@/components/portal/nav';
import { requireMedia } from '@/lib/portal/context';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// Alt her avhenger av sesjonen; ingenting kan prerendres.
export const dynamic = 'force-dynamic';

/** Det medierollen styrer. Samme punkter står under «Innhold» for administratorer. */
const MEDIA_ITEMS: NavGroup['items'] = [
  { href: '/admin/nyheter', label: 'Nyheter', icon: 'news' },
  { href: '/admin/bibliotek', label: 'Bibliotek', icon: 'library' },
  { href: '/admin/galleri', label: 'Galleri', icon: 'gallery' },
  { href: '/admin/faq', label: 'Spørsmål og svar', icon: 'faq' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Slipper inn administratorer og media, og sender alle andre videre. Hver
  // side kaller sin egen vokter i tillegg: layouten kjøres ikke på nytt når
  // man går fra side til side, og RLS stopper uansett det rollen ikke får se.
  const { supabase, ctx } = await requireMedia('/admin');

  // Media får bare nyheter, biblioteket, galleriet og spørsmålene. Tellingene under gjelder bestillinger,
  // saker og tilgang, som rollen ikke har innsyn i, så de hentes ikke.
  if (ctx.staffRole !== 'admin') {
    return (
      <PortalShell area="admin" ctx={ctx} groups={[{ title: 'Innhold', items: MEDIA_ITEMS }]}>
        {children}
      </PortalShell>
    );
  }

  const head = { count: 'exact' as const, head: true };
  const [newOrders, openTickets, serviceRequests, accessRequests, lowStock] = await Promise.all([
    supabase.from('orders').select('id', head).eq('status', 'new'),
    supabase.from('support_tickets').select('id', head).in('status', ['open', 'in_progress']),
    supabase.from('service_bookings').select('id', head).eq('status', 'requested'),
    supabase.from('ladder_access_requests').select('id', head).eq('status', 'pending'),
    // Aktive varer der det som er tilgjengelig, er under minimum.
    supabase.from('stock_overview').select('id', head).eq('below_minimum', true),
  ]);

  const groups: NavGroup[] = [
    { items: [{ href: '/admin', label: 'Oversikt', icon: 'dashboard', exact: true }] },
    {
      title: 'Salg',
      items: [
        { href: '/admin/bestillinger', label: 'Bestillinger', icon: 'orders', count: newOrders.count ?? 0 },
        { href: '/admin/leveranser', label: 'Leveranser', icon: 'deliveries' },
        { href: '/admin/henvendelser', label: 'Henvendelser', icon: 'inbox' },
      ],
    },
    {
      title: 'Kunder',
      items: [
        { href: '/admin/selskap', label: 'Selskap', icon: 'companies' },
        { href: '/admin/brukere', label: 'Brukere', icon: 'people' },
        { href: '/admin/tilgang', label: 'Tilgangsforespørsler', icon: 'access', count: accessRequests.count ?? 0 },
      ],
    },
    {
      title: 'Leidere',
      items: [
        { href: '/admin/leidere', label: 'Leidere', icon: 'ladder' },
        { href: '/admin/skap', label: 'Oppbevaringsskap', icon: 'cabinet' },
        { href: '/admin/prosjekter', label: 'Prosjekter', icon: 'project' },
        { href: '/produksjon', label: 'Produksjon', icon: 'production' },
        { href: '/admin/service', label: 'Service og avtaler', icon: 'service', count: serviceRequests.count ?? 0 },
        { href: '/admin/vedlikehold', label: 'Vedlikeholdsrapporter', icon: 'reports' },
      ],
    },
    {
      title: 'Lager',
      items: [
        // De andre punktene ligger under samme sti. Menyen markerer den lengste stien som passer.
        { href: '/admin/lager', label: 'Lager', icon: 'stock', count: lowStock.count ?? 0 },
        { href: '/admin/lager/innkjop', label: 'Innkjøp', icon: 'purchase' },
        { href: '/admin/lager/stykklister', label: 'Stykklister', icon: 'parts' },
        { href: '/admin/lager/forbruk', label: 'Forbruk', icon: 'usage' },
      ],
    },
    {
      title: 'Support',
      items: [{ href: '/admin/saker', label: 'Saker', icon: 'support', count: openTickets.count ?? 0 }],
    },
    {
      title: 'Innhold',
      items: [...MEDIA_ITEMS, { href: '/admin/priser', label: 'Produkter og priser', icon: 'prices' }],
    },
    {
      title: 'Oppsett',
      items: [
        { href: '/admin/ansatte', label: 'Ansatte og roller', icon: 'staff' },
        { href: '/admin/produksjonssteg', label: 'Produksjonssteg', icon: 'steps' },
        { href: '/admin/e-post', label: 'E-post', icon: 'inbox' },
      ],
    },
  ];

  return <PortalShell area="admin" ctx={ctx} groups={groups}>{children}</PortalShell>;
}
