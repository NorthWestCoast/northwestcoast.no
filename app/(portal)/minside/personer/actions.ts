'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/portal/context';
import type { PortalContext } from '@/lib/portal/context';
import { type ActionResult, err, fail, ok, optional, text, uuid } from '@/lib/portal/forms';
import { createInvitation } from '@/lib/portal/invite';

type Role = 'owner' | 'admin' | 'member';

const isRole = (value: string): value is Role => value === 'owner' || value === 'admin' || value === 'member';

function refresh() {
  revalidatePath('/minside', 'layout');
}

/** Brukerens rolle i selskapet. NorthWestCoast-administratorer regnes som eier. */
function myRole(ctx: PortalContext, companyId: string): Role | null {
  if (ctx.staffRole === 'admin') return 'owner';
  return ctx.companies.find((company) => company.id === companyId)?.role ?? null;
}

/** Inviterer en kollega inn i selskapet. */
export async function inviteToCompany(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const companyId = uuid(formData.get('company_id'));
  if (!companyId) return err('Fant ikke selskapet.');

  const role = text(formData.get('role'), 20);
  if (!isRole(role)) return err('Velg en rolle.');

  const mine = myRole(ctx, companyId);
  if (mine !== 'owner' && mine !== 'admin') return err('Bare eiere og administratorer kan invitere.');
  if (role === 'owner' && mine !== 'owner') return err('Bare en eier kan invitere en ny eier.');

  const { data: company } = await supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle();
  if (!company) return err('Fant ikke selskapet.');

  const result = await createInvitation(supabase, ctx, {
    scope: 'company',
    id: company.id,
    role,
    email: text(formData.get('email'), 160),
    targetName: company.name,
    message: optional(formData.get('message'), 500),
  });

  if (result.ok) refresh();
  return result;
}

/** Er dette den eneste eieren i selskapet? Da kan rollen ikke tas fra henne. */
async function isLastOwner(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  companyId: string,
  userId: string,
): Promise<boolean> {
  const { data: owners } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('role', 'owner');
  // Kan eierne ikke leses, er det tryggest å anta at dette er den siste.
  if (!owners) return true;
  return owners.some((owner) => owner.user_id === userId) && owners.length <= 1;
}

export async function changeMemberRole(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const companyId = uuid(formData.get('company_id'));
  const userId = uuid(formData.get('user_id'));
  if (!companyId || !userId) return err('Fant ikke medlemmet.');

  const role = text(formData.get('role'), 20);
  if (!isRole(role)) return err('Velg en rolle.');

  const mine = myRole(ctx, companyId);
  if (mine !== 'owner' && mine !== 'admin') return err('Bare eiere og administratorer kan endre roller.');

  const { data: member } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return err('Fant ikke medlemmet.');
  if (member.role === role) return ok('Rollen er uendret.');

  if ((member.role === 'owner' || role === 'owner') && mine !== 'owner') {
    return err('Bare en eier kan gi eller ta bort eierrollen.');
  }
  if (member.role === 'owner' && (await isLastOwner(supabase, companyId, userId))) {
    return err('Selskapet må ha minst én eier. Gjør en annen til eier først.');
  }

  const { data, error } = await supabase
    .from('company_members')
    .update({ role })
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return fail(error, 'Rollen kunne ikke endres.');
  if (!data?.length) return err('Du har ikke tilgang til å endre denne rollen.');

  refresh();
  return ok('Rollen er endret.');
}

export async function removeCompanyMember(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const companyId = uuid(formData.get('company_id'));
  const userId = uuid(formData.get('user_id'));
  if (!companyId || !userId) return err('Fant ikke medlemmet.');

  const mine = myRole(ctx, companyId);
  if (mine !== 'owner' && mine !== 'admin') return err('Bare eiere og administratorer kan fjerne medlemmer.');

  const { data: member } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return err('Fant ikke medlemmet.');

  if (member.role === 'owner') {
    if (mine !== 'owner') return err('Bare en eier kan fjerne en annen eier.');
    if (await isLastOwner(supabase, companyId, userId)) {
      return err('Den siste eieren kan ikke fjernes. Gjør en annen til eier først.');
    }
  }

  const { data, error } = await supabase
    .from('company_members')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return fail(error, 'Medlemmet kunne ikke fjernes.');
  if (!data?.length) return err('Du har ikke tilgang til å fjerne dette medlemmet.');

  refresh();
  return ok('Medlemmet er fjernet fra selskapet.');
}
