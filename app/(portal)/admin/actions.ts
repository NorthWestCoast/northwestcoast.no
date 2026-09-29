'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { sendInviteEmail } from '@/lib/invitations';

/**
 * Server actions for admin.
 *
 * Alle skriver gjennom den innloggede ansattes EGEN sesjon, ikke service-role.
 * Det betyr at RLS fortsatt gjelder: mister noen staff-flagget, slutter
 * skrivingen å virke umiddelbart, uten at vi må huske å sjekke noe i koden.
 * Prisen er at policyene faktisk må være på plass – to manglende policyer
 * ble oppdaget nettopp fordi denne veien ble valgt.
 */

export type { ActionResult } from '@/components/action-form';
import type { ActionResult } from '@/components/action-form';

/** Normaliserer til kun siffer. Databasen validerer kontrollsifferet. */
const digits = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : '';

const text = (value: FormDataEntryValue | null, max = 200) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const optional = (value: FormDataEntryValue | null, max = 200) => text(value, max) || null;

// ── Selskap ────────────────────────────────────────────────────────────────

export async function createCompany(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const name = text(formData.get('name'), 160);
  if (!name) return { ok: false, error: 'Navn er påkrevd.' };

  const orgNumber = digits(formData.get('org_number'));

  const { error } = await supabase.from('companies').insert({
    name,
    org_number: orgNumber || null,
    address: optional(formData.get('address')),
    postal_code: optional(formData.get('postal_code'), 10),
    city: optional(formData.get('city'), 80),
  });

  if (error) {
    // Kontrollsifferet valideres i databasen, ikke her – da gjelder regelen
    // uansett hvilken vei dataene kommer inn.
    if (error.message.includes('is_valid_org_number')) {
      return { ok: false, error: `"${orgNumber}" er ikke et gyldig organisasjonsnummer.` };
    }
    if (error.code === '23505') {
      return { ok: false, error: 'Et selskap med dette organisasjonsnummeret finnes allerede.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/selskap');
  return { ok: true, message: `${name} er opprettet.` };
}

// ── Fartøy ─────────────────────────────────────────────────────────────────

export async function createVessel(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const companyId = text(formData.get('company_id'), 40);
  const name = text(formData.get('name'), 160);
  if (!companyId || !name) return { ok: false, error: 'Selskap og navn er påkrevd.' };

  const imo = digits(formData.get('imo'));

  const { error } = await supabase.from('vessels').insert({
    company_id: companyId,
    name,
    imo: imo || null,
    call_sign: optional(formData.get('call_sign'), 20),
    vessel_type: optional(formData.get('vessel_type'), 80),
    home_port: optional(formData.get('home_port'), 80),
  });

  if (error) {
    if (error.message.includes('is_valid_imo')) {
      return {
        ok: false,
        error: `"${imo}" er ikke et gyldig IMO-nummer (kontrollsifferet stemmer ikke).`,
      };
    }
    if (error.code === '23505') {
      return { ok: false, error: 'Et fartøy med dette IMO-nummeret er allerede registrert.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/selskap/${companyId}`);
  return { ok: true, message: `${name} er lagt til.` };
}

// ── Leidere ────────────────────────────────────────────────────────────────

/**
 * Registrerer flere leidere i én operasjon.
 *
 * Produksjon skjer i serier, så å taste inn én og én er feil arbeidsflyt.
 * Serienumrene limes inn som én per linje.
 */
export async function registerLadders(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = text(formData.get('product_id'), 40);
  const producedAt = optional(formData.get('produced_at'), 10);
  const raw = text(formData.get('serial_numbers'), 4000);

  if (!productId) return { ok: false, error: 'Velg et produkt.' };

  const serials = [...new Set(
    raw.split('\n').map((line) => line.trim()).filter(Boolean),
  )];

  if (serials.length === 0) return { ok: false, error: 'Skriv inn minst ett serienummer.' };
  if (serials.length > 200) return { ok: false, error: 'Maks 200 leidere per registrering.' };

  const { error, count } = await supabase
    .from('ladders')
    .insert(
      serials.map((serial) => ({
        serial_number: serial,
        product_id: productId,
        produced_at: producedAt,
        status: 'in_production' as const,
      })),
      { count: 'exact' },
    );

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error:
          'Ett eller flere serienumre er allerede registrert. ' +
          'Ingen ble lagt inn – rett opp lista og prøv igjen.',
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/leidere');
  return { ok: true, message: `${count ?? serials.length} leidere registrert.` };
}

/** Kobler en leider til et fartøy ved levering. */
export async function assignLadder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ladderId = text(formData.get('ladder_id'), 40);
  const vesselId = text(formData.get('vessel_id'), 40);
  const installedAt = optional(formData.get('installed_at'), 10);

  if (!ladderId || !vesselId) return { ok: false, error: 'Velg leider og fartøy.' };

  const { error } = await supabase
    .from('ladders')
    .update({
      vessel_id: vesselId,
      installed_at: installedAt,
      status: installedAt ? 'installed' : 'delivered',
    })
    .eq('id', ladderId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/leidere');
  return { ok: true, message: 'Leideren er koblet til fartøyet.' };
}

// ── Servicerapport ─────────────────────────────────────────────────────────

export async function recordService(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();

  const ladderId = text(formData.get('ladder_id'), 40);
  const performedAt = text(formData.get('performed_at'), 10);
  const performedBy = text(formData.get('performed_by'), 120);
  const result = text(formData.get('result'), 20);

  if (!ladderId || !performedAt || !performedBy) {
    return { ok: false, error: 'Leider, dato og utført av er påkrevd.' };
  }
  if (!['ok', 'ok_with_remarks', 'failed'].includes(result)) {
    return { ok: false, error: 'Velg et resultat.' };
  }

  // Er ikke neste frist satt manuelt, beregnes den fra leiderens eget
  // intervall – samme regel som ladder_status bruker.
  let nextDue = optional(formData.get('next_service_due'), 10);
  if (!nextDue) {
    const { data: ladder } = await supabase
      .from('ladders')
      .select('service_interval_months')
      .eq('id', ladderId)
      .maybeSingle();

    const months = ladder?.service_interval_months ?? 12;
    const due = new Date(performedAt);
    due.setMonth(due.getMonth() + months);
    nextDue = due.toISOString().slice(0, 10);
  }

  const { error } = await supabase.from('service_reports').insert({
    ladder_id: ladderId,
    performed_at: performedAt,
    performed_by: performedBy,
    technician_user_id: user.id,
    findings: optional(formData.get('findings'), 4000),
    result: result as 'ok' | 'ok_with_remarks' | 'failed',
    next_service_due: nextDue,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin');
  revalidatePath('/admin/service');
  return { ok: true, message: `Servicerapport lagret. Neste frist: ${nextDue}.` };
}

// ── Uparede vedlikeholdsrapporter ──────────────────────────────────────────

/**
 * Kobler en innsendt rapport til riktig leider.
 *
 * Det offentlige skjemaet tar imot hvilket som helst serienummer, og lagrer
 * råteksten selv når oppslaget bommer. Dette er der de bommene ryddes opp.
 */
export async function linkMaintenanceLog(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const logId = text(formData.get('log_id'), 40);
  const ladderId = text(formData.get('ladder_id'), 40);

  if (!logId || !ladderId) return { ok: false, error: 'Velg en leider.' };

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, vessel_id')
    .eq('id', ladderId)
    .maybeSingle();

  if (!ladder) return { ok: false, error: 'Fant ikke leideren.' };

  const { error } = await supabase
    .from('maintenance_logs')
    .update({ ladder_id: ladder.id, vessel_id: ladder.vessel_id })
    .eq('id', logId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/vedlikehold');
  return { ok: true, message: 'Rapporten er koblet til leideren.' };
}

// ── Invitasjon ─────────────────────────────────────────────────────────────

export async function inviteMember(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();

  const companyId = text(formData.get('company_id'), 40);
  const email = text(formData.get('email'), 160).toLowerCase();
  const role = text(formData.get('role'), 20) || 'member';

  if (!companyId || !email) return { ok: false, error: 'Selskap og e-post er påkrevd.' };
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

  if (error) return { ok: false, error: error.message };

  // Uten e-post vet ikke personen at hun har fått tilgang; raden i databasen
  // hjelper henne ikke. Feiler utsendingen, står invitasjonen likevel klar.
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

  revalidatePath(`/admin/selskap/${companyId}`);
  return {
    ok: true,
    message: `${email} er invitert og varslet på e-post.`,
  };
}
