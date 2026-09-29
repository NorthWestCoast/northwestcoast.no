'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { sendInviteEmail } from '@/lib/invitations';

/**
 * Server actions for kundeportalen.
 *
 * Alt går gjennom kundens egen sesjon. RLS avgjør hva hun får lov til –
 * `is_company_admin()` er allerede kravet i policyene for invitasjoner og
 * selskapsoppdatering, så koden her trenger ikke gjenta autorisasjonen.
 * Den sjekker bare nok til å gi en forståelig feilmelding framfor en rå
 * databasefeil.
 */

export type { ActionResult } from '@/components/action-form';
import type { ActionResult } from '@/components/action-form';

const text = (value: FormDataEntryValue | null, max = 200) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

async function requireUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/logg-inn?neste=/minside');
  return { supabase, user };
}

/** Inviterer en kollega inn i eget selskap. Krever admin- eller eierrolle. */
export async function inviteColleague(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const companyId = text(formData.get('company_id'), 40);
  const email = text(formData.get('email'), 160).toLowerCase();
  const role = text(formData.get('role'), 20) || 'member';

  if (!companyId || !email) return { ok: false, error: 'E-post er påkrevd.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'E-postadressen ser ikke gyldig ut.' };
  }

  const { error } = await supabase.from('company_invitations').upsert(
    {
      company_id: companyId,
      email,
      role: role as 'owner' | 'admin' | 'member',
      invited_by: user.id,
    },
    { onConflict: 'company_id,email' },
  );

  if (error) {
    // RLS avviser med en tom eller manglende rad når man ikke er administrator.
    if (error.code === '42501' || error.code === 'PGRST116') {
      return { ok: false, error: 'Bare administratorer kan invitere nye personer.' };
    }
    return { ok: false, error: error.message };
  }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle();

  await sendInviteEmail({
    email,
    companyName: company?.name ?? 'NorthWest Coast',
    invitedBy: user.email,
  });

  revalidatePath('/minside/personer');
  return { ok: true, message: `${email} er invitert og varslet på e-post.` };
}

/** Oppdaterer selskapets kontaktopplysninger. Krever admin- eller eierrolle. */
export async function updateCompanyProfile(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const companyId = text(formData.get('company_id'), 40);
  const name = text(formData.get('name'), 160);
  if (!companyId || !name) return { ok: false, error: 'Navn er påkrevd.' };

  const { error, count } = await supabase
    .from('companies')
    .update(
      {
        name,
        address: text(formData.get('address')) || null,
        postal_code: text(formData.get('postal_code'), 10) || null,
        city: text(formData.get('city'), 80) || null,
      },
      { count: 'exact' },
    )
    .eq('id', companyId);

  if (error) return { ok: false, error: error.message };

  // RLS filtrerer bort raden i stedet for å kaste feil når man mangler
  // rettigheter, så null oppdaterte rader er selve avvisningen.
  if (count === 0) {
    return { ok: false, error: 'Bare administratorer kan endre selskapsopplysninger.' };
  }

  revalidatePath('/minside/profil');
  return { ok: true, message: 'Opplysningene er oppdatert.' };
}
