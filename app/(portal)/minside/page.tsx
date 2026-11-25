import Link from 'next/link';
import { requireUser } from '@/lib/portal/context';
import { PageHeader } from '@/components/portal/ui';
import Invitations from '@/components/minside/invitations';
import Onboarding from '@/components/minside/onboarding';
import CustomerDashboard from '@/components/minside/dashboard';

/**
 * Oversikten. Innholdet ligger i CustomerDashboard, som admin også bruker
 * til «Vis som kunde».
 */
export default async function MinSidePage() {
  const { supabase, ctx } = await requireUser('/minside');

  if (!ctx.hasAccess && ctx.staffRole === null) {
    return <Onboarding supabase={supabase} ctx={ctx} />;
  }

  return (
    <>
      <PageHeader
        title="Oversikt"
        description={`Logget inn som ${ctx.displayName}.`}
        actions={
          <>
            <Link href="/minside/bestill" className="pt-btn">Bestill leider og deler</Link>
            <Link href="/minside/support/ny" className="pt-btn pt-btn-ghost">Kontakt support</Link>
          </>
        }
      />

      <Invitations invitations={ctx.invitations} />

      <CustomerDashboard supabase={supabase} viewerId={ctx.userId} />
    </>
  );
}
