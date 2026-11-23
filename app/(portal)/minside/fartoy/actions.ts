'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { managedCompanies, requireUser } from '@/lib/portal/context';
import {
  type ActionResult, err, fail, ok, optional, text, uuid,
} from '@/lib/portal/forms';
import { createInvitation } from '@/lib/portal/invite';
import { readVessel, vesselError } from '@/components/portal/vessel-values';

/** Vises når IMO-nummeret alt står på et annet fartøy. */
const IMO_TAKEN = 'Ta kontakt med NorthWestCoast hvis det er ditt.';

function refresh() {
  revalidatePath('/minside', 'layout');
}

export async function createVessel(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const companyId = uuid(formData.get('company_id'));
  if (!companyId) return err('Velg hvilket selskap fartøyet tilhører.');
  if (ctx.staffRole !== 'admin' && !managedCompanies(ctx).some((c) => c.id === companyId)) {
    return err('Bare eiere og administratorer i selskapet kan legge til fartøy.');
  }

  const parsed = readVessel(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { data: vessel, error } = await supabase
    .from('vessels')
    .insert({ company_id: companyId, ...parsed.values })
    .select('id')
    .single();
  if (error || !vessel) {
    return error ? vesselError(error, 'Fartøyet kunne ikke lagres.', IMO_TAKEN) : err('Fartøyet kunne ikke lagres.');
  }

  refresh();
  redirect(`/minside/fartoy/${vessel.id}`);
}

export async function updateVessel(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const vesselId = uuid(formData.get('vessel_id'));
  if (!vesselId) return err('Fant ikke fartøyet.');

  const parsed = readVessel(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { data, error } = await supabase
    .from('vessels')
    .update(parsed.values)
    .eq('id', vesselId)
    .select('id');
  if (error) return vesselError(error, 'Endringene kunne ikke lagres.', IMO_TAKEN);
  // RLS filtrerer bort raden framfor å kaste feil når man mangler rettigheter.
  if (!data?.length) return err('Bare eiere og administratorer i selskapet kan endre fartøyet.');

  refresh();
  return ok('Opplysningene er lagret.');
}

/** Gir en person tilgang til fartøyet og alle leiderne om bord. */
export async function inviteToVessel(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireUser();

  const vesselId = uuid(formData.get('vessel_id'));
  if (!vesselId) return err('Fant ikke fartøyet.');

  const role = text(formData.get('role'), 20);
  if (role !== 'master' && role !== 'crew' && role !== 'viewer') return err('Velg en rolle.');

  const { data: vessel } = await supabase.from('vessels').select('id, name').eq('id', vesselId).maybeSingle();
  if (!vessel) return err('Du har ikke tilgang til dette fartøyet.');

  const result = await createInvitation(supabase, ctx, {
    scope: 'vessel',
    id: vessel.id,
    role,
    email: text(formData.get('email'), 160),
    targetName: vessel.name,
    message: optional(formData.get('message'), 500),
  });

  if (result.ok) refresh();
  return result;
}

export async function removeVesselMember(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const vesselId = uuid(formData.get('vessel_id'));
  const userId = uuid(formData.get('user_id'));
  if (!vesselId || !userId) return err('Fant ikke tilgangen.');

  const { data, error } = await supabase
    .from('vessel_members')
    .delete()
    .eq('vessel_id', vesselId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return fail(error, 'Tilgangen kunne ikke fjernes.');
  if (!data?.length) return err('Bare eiere og administratorer i selskapet kan fjerne tilganger på fartøyet.');

  refresh();
  return ok('Tilgangen er fjernet.');
}
