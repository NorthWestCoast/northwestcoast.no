import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/supabase/staff';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// Alt her avhenger av sesjonen; ingenting kan prerendres.
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Oversikt' },
  { href: '/admin/selskap', label: 'Selskap' },
  { href: '/admin/leidere', label: 'Leidere' },
  { href: '/admin/service', label: 'Service' },
  { href: '/admin/vedlikehold', label: 'Vedlikehold' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Kaster ut alle som ikke har staff-flagget. RLS stopper dem uansett, men
  // det er bedre å redirecte enn å rendre en tom side.
  const { user } = await requireStaff();

  return (
    <div className="adm">
      <header className="adm-head">
        <div className="adm-brand">
          <Link href="/admin">NorthWest Coast · Admin</Link>
          <span>{user.email}</span>
        </div>
        <nav className="adm-nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
          <Link href="/" className="adm-nav-out">← Til nettsiden</Link>
        </nav>
      </header>

      <main className="adm-main">{children}</main>
    </div>
  );
}
