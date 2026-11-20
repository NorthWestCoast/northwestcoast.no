import type { Metadata } from 'next';
import PortalShell from '@/components/portal/shell';
import type { NavGroup } from '@/components/portal/nav';
import { requireProduction } from '@/lib/portal/context';

export const metadata: Metadata = {
  title: 'Produksjon',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProduksjonLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await requireProduction();

  const groups: NavGroup[] = [
    {
      items: [
        { href: '/produksjon', label: 'Tavle', icon: 'production', exact: true },
        { href: '/produksjon/ferdige', label: 'Sendt og levert', icon: 'deliveries' },
        { href: '/produksjon/lager', label: 'Lager', icon: 'stock' },
      ],
    },
  ];

  if (ctx.staffRole === 'admin') {
    groups.push({
      title: 'Administrator',
      items: [
        { href: '/produksjon/ny', label: 'Ny jobb', icon: 'jobs' },
        { href: '/admin/produksjonssteg', label: 'Produksjonssteg', icon: 'steps' },
      ],
    });
  }

  return <PortalShell area="produksjon" ctx={ctx} groups={groups}>{children}</PortalShell>;
}
