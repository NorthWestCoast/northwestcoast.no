import type { PortalContext } from '@/lib/portal/context';
import type { LadderView, PortalSupabase } from '@/components/minside/util';

export type SectionProps = {
  supabase: PortalSupabase;
  ctx: PortalContext;
  ladder: LadderView;
  /** Kan gi og fjerne tilgang og slette andres oppgaver. Bare for visning. */
  canManage: boolean;
};
