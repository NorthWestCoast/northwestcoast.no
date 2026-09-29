import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Footer from '@/components/footer';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Min side',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/minside', label: 'Oversikt' },
  { href: '/minside/fartoy', label: 'Fartøy' },
  { href: '/minside/bestillinger', label: 'Bestillinger' },
  { href: '/minside/personer', label: 'Personer' },
  { href: '/minside/profil', label: 'Profil' },
];

export default async function MinSideLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/logg-inn?neste=/minside');

  return (
    <>
      <header className="ms-head">
        <div className="ms-head-inner">
          <Link href="/minside" className="ms-brand">NorthWest Coast · Min side</Link>
          <nav className="ms-nav">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </nav>
          <span className="ms-user">{user.email}</span>
        </div>
      </header>

      <main className="ms-main">{children}</main>

      <Footer />
    </>
  );
}
