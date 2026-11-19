'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { createInvitation } from '@/lib/portal/invite';
import {
  type ActionResult, digits, err, fail, isEmail, isoDate, ok, optional, text, uuid,
} from '@/lib/portal/forms';
import { dato } from '@/lib/format';

/**
 * Server actions som brukes fra flere admin-sider: selskap, fartøy, tilgang,
 * leidere, servicerapporter og kobling av vedlikeholdsrapporter.
 *
 * Alle skriver gjennom administratorens EGEN sesjon. RLS (app.is_staff()) er
 * autorisasjonslaget; requireStaff() her sparer bare et unødvendig kall.
 */

const COMPANY_ROLES = ['owner', 'admin', 'member'] as const;
type CompanyRole = (typeof COMPANY_ROLES)[number];
const isCompanyRole = (value: string): value is CompanyRole =>
  (COMPANY_ROLES as readonly string[]).includes(value);

// ── Selskap ────────────────────────────────────────────────────────────────

function companyFields(formData: FormData) {
  const contactEmail = text(formData.get('contact_email'), 160).toLowerCase();
  return {
    name: text(formData.get('name'), 160),
    org_number: digits(formData.get('org_number')) || null,
    address: optional(formData.get('address')),
    postal_code: optional(formData.get('postal_code'), 10),
    city: optional(formData.get('city'), 80),
    contact_name: optional(formData.get('contact_name'), 120),
    contact_email: contactEmail || null,
    contact_phone: optional(formData.get('contact_phone'), 40),
  };
}

function companyError(error: { code?: string; message: string }, orgNumber: string | null): ActionResult {
  // Kontrollsifferet valideres i databasen, så regelen gjelder uansett
  // hvilken vei dataene kommer inn.
  if (error.code === '23514' && /org_number/.test(error.message)) {
    return err(`«${orgNumber ?? ''}» er ikke et gyldig organisasjonsnummer.`);
  }
  if (error.code === '23505') return err('Et selskap med dette organisasjonsnummeret finnes allerede.');
  return fail(error);
}

export async function createCompany(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const fields = companyFields(formData);
  if (!fields.name) return err('Navn er påkrevd.');
  if (fields.contact_email && !isEmail(fields.contact_email)) return err('E-postadressen ser ikke gyldig ut.');

  const { error } = await supabase.from('companies').insert(fields);
  if (error) return companyError(error, fields.org_number);

  revalidatePath('/admin/selskap');
  return ok(`${fields.name} er opprettet.`);
}

export async function updateCompany(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('company_id'));
  if (!id) return err('Fant ikke selskapet.');

  const fields = companyFields(formData);
  if (!fields.name) return err('Navn er påkrevd.');
  if (fields.contact_email && !isEmail(fields.contact_email)) return err('E-postadressen ser ikke gyldig ut.');

  const { error } = await supabase.from('companies').update(fields).eq('id', id);
  if (error) return companyError(error, fields.org_number);

  revalidatePath('/admin/selskap');
  revalidatePath(`/admin/selskap/${id}`);
  return ok('Selskapet er oppdatert.');
}

// ── Fartøy ─────────────────────────────────────────────────────────────────

export async function createVessel(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const companyId = uuid(formData.get('company_id'));
  const name = text(formData.get('name'), 160);
  if (!companyId || !name) return err('Selskap og navn er påkrevd.');

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
    if (error.code === '23514' && /imo/.test(error.message)) {
      return err(`«${imo}» er ikke et gyldig IMO-nummer (kontrollsifferet stemmer ikke).`);
    }
    if (error.code === '23505') return err('Et fartøy med dette IMO-nummeret er allerede registrert.');
    return fail(error);
  }

  revalidatePath(`/admin/selskap/${companyId}`);
  revalidatePath('/admin/selskap');
  return ok(`${name} er lagt til.`);
}

// ── Medlemmer og invitasjoner ──────────────────────────────────────────────

export async function setMemberRole(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const companyId = uuid(formData.get('company_id'));
  const userId = uuid(formData.get('user_id'));
  const role = text(formData.get('role'), 20);
  if (!companyId || !userId) return err('Fant ikke medlemmet.');
  if (!isCompanyRole(role)) return err('Velg en rolle.');

  const { error } = await supabase
    .from('company_members')
    .update({ role })
    .eq('company_id', companyId)
    .eq('user_id', userId);
  if (error) return fail(error);

  revalidatePath(`/admin/selskap/${companyId}`);
  revalidatePath('/admin/brukere');
  return ok('Rollen er endret.');
}

export async function removeMember(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const companyId = uuid(formData.get('company_id'));
  const userId = uuid(formData.get('user_id'));
  if (!companyId || !userId) return err('Fant ikke medlemmet.');

  const { error } = await supabase
    .from('company_members')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId);
  if (error) return fail(error);

  revalidatePath(`/admin/selskap/${companyId}`);
  revalidatePath('/admin/brukere');
  return ok('Medlemmet er fjernet fra selskapet.');
}

/** Inviterer en person til et selskap. Brukes fra selskapssiden og fra Brukere. */
export async function inviteToCompany(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireStaff();

  const companyId = uuid(formData.get('company_id'));
  const email = text(formData.get('email'), 160);
  const role = text(formData.get('role'), 20) || 'member';
  if (!companyId) return err('Velg et selskap.');
  if (!email) return err('E-post er påkrevd.');
  if (!isCompanyRole(role)) return err('Velg en rolle.');

  const { data: company } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
  if (!company) return err('Fant ikke selskapet.');

  const result = await createInvitation(supabase, ctx, {
    scope: 'company',
    id: companyId,
    role,
    email,
    targetName: company.name,
    message: optional(formData.get('message'), 500),
  });

  revalidatePath(`/admin/selskap/${companyId}`);
  revalidatePath('/admin/brukere');
  return result;
}

export async function revokeInvitation(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const id = uuid(formData.get('invitation_id'));
  if (!id) return err('Fant ikke invitasjonen.');

  // revoked_at er den eneste kolonnen som kan endres; raden beholdes som spor.
  const { data, error } = await supabase
    .from('access_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('accepted_at', null)
    .select('company_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Invitasjonen er allerede brukt eller trukket tilbake.');

  if (data.company_id) revalidatePath(`/admin/selskap/${data.company_id}`);
  revalidatePath('/admin/brukere');
  return ok('Invitasjonen er trukket tilbake.');
}

// ── Leidere ────────────────────────────────────────────────────────────────

/**
 * Registrerer flere leidere i én operasjon.
 *
 * Produksjon skjer i serier, så numrene limes inn, ett per linje. Finnes ett
 * av dem fra før, avvises hele partiet og ingenting lagres.
 */
export async function registerLadders(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  const producedAt = isoDate(formData.get('produced_at'));
  const companyId = uuid(formData.get('company_id'));
  const raw = text(formData.get('serial_numbers'), 8000);

  if (!productId) return err('Velg et produkt.');

  const serials = [...new Set(raw.split('\n').map((line) => line.trim().toUpperCase()).filter(Boolean))];
  if (serials.length === 0) return err('Skriv inn minst ett produksjonsnummer.');
  if (serials.length > 200) return err('Maks 200 leidere per registrering.');
  const invalid = serials.find((serial) => !/^[A-Z0-9][A-Z0-9._/-]{2,39}$/.test(serial));
  if (invalid) return err(`«${invalid}» er ikke et gyldig produksjonsnummer (3–40 tegn: bokstaver, tall, bindestrek).`);

  const { error, count } = await supabase.from('ladders').insert(
    serials.map((serial) => ({
      serial_number: serial,
      product_id: productId,
      produced_at: producedAt,
      company_id: companyId,
      status: 'in_production' as const,
    })),
    { count: 'exact' },
  );

  if (error) {
    if (error.code === '23505') {
      return err('Ett eller flere produksjonsnumre er allerede registrert. Ingen ble lagt inn. Rett opp lista og prøv igjen.');
    }
    return fail(error);
  }

  revalidatePath('/admin/leidere');
  revalidatePath('/admin');
  return ok(`${count ?? serials.length} leidere er registrert.`);
}

/**
 * Knytter en leider til en kunde: et selskap, et fartøy, eller begge.
 *
 * Velges et fartøy, følger selskapet fartøyet (trigger i databasen). Med
 * monteringsdato regnes leideren som i bruk, og servicefristen begynner å
 * løpe; uten dato er den levert, men ikke montert. Velges bare selskap, tas
 * leideren av et fartøy som tilhører et annet selskap.
 */
export async function assignLadder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const companyId = uuid(formData.get('company_id'));
  const vesselId = uuid(formData.get('vessel_id'));
  const installedAt = isoDate(formData.get('installed_at'));

  if (!ladderId) return err('Velg en leider.');
  if (!companyId && !vesselId) return err('Velg et selskap eller et fartøy.');

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, status, vessel_id, vessels(company_id)')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return err('Fant ikke leideren.');

  let message: string;
  let error: { code?: string; message: string } | null;

  if (vesselId) {
    const { data: vessel } = await supabase
      .from('vessels')
      .select('id, name, company_id')
      .eq('id', vesselId)
      .maybeSingle();
    if (!vessel) return err('Fant ikke fartøyet.');
    if (companyId && vessel.company_id !== companyId) {
      return err('Fartøyet tilhører et annet selskap enn det du valgte.');
    }

    ({ error } = await supabase
      .from('ladders')
      .update({
        vessel_id: vesselId,
        installed_at: installedAt,
        status: installedAt ? 'installed' : 'delivered',
      })
      .eq('id', ladderId));
    message = installedAt
      ? `Leideren er montert på ${vessel.name}.`
      : `Leideren er knyttet til ${vessel.name} (levert, ikke montert).`;
  } else {
    // Bare selskap: et fartøy i et annet selskap kan ikke bli stående.
    const leavesVessel = ladder.vessel_id !== null && ladder.vessels?.company_id !== companyId;

    ({ error } = await supabase
      .from('ladders')
      .update(
        leavesVessel
          ? {
              company_id: companyId,
              vessel_id: null,
              status: ladder.status === 'installed' ? 'delivered' : ladder.status,
            }
          : { company_id: companyId },
      )
      .eq('id', ladderId));
    message = leavesVessel
      ? 'Leideren er flyttet til selskapet og tatt av fartøyet den sto på.'
      : 'Leideren er knyttet til selskapet.';
  }

  if (error) return fail(error);

  revalidatePath('/admin/leidere');
  revalidatePath('/admin');
  revalidatePath(`/minside/leider/${ladderId}`);
  return ok(message);
}

// ── Servicerapport ─────────────────────────────────────────────────────────

/**
 * Registrerer en fagmessig service. Det er denne som teller ved tilsyn, og
 * den avslutter åpne servicebestillinger på leideren (trigger i databasen).
 */
export async function recordService(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const performedAt = isoDate(formData.get('performed_at'));
  const performedBy = text(formData.get('performed_by'), 120);
  const result = text(formData.get('result'), 20);

  if (!ladderId || !performedAt || !performedBy) return err('Leider, dato og utført av er påkrevd.');
  if (result !== 'ok' && result !== 'ok_with_remarks' && result !== 'failed') return err('Velg et resultat.');

  // Er ikke neste frist satt, beregnes den fra leiderens eget intervall –
  // samme regel som ladder_status bruker.
  let nextDue = isoDate(formData.get('next_service_due'));
  if (nextDue && nextDue < performedAt) return err('Neste frist kan ikke være før servicen ble utført.');
  if (!nextDue) {
    const { data: ladder } = await supabase
      .from('ladders')
      .select('service_interval_months')
      .eq('id', ladderId)
      .maybeSingle();
    if (!ladder) return err('Fant ikke leideren.');

    const due = new Date(`${performedAt}T00:00:00Z`);
    due.setUTCMonth(due.getUTCMonth() + ladder.service_interval_months);
    nextDue = due.toISOString().slice(0, 10);
  }

  const { error } = await supabase.from('service_reports').insert({
    ladder_id: ladderId,
    performed_at: performedAt,
    performed_by: performedBy,
    technician_user_id: user.id,
    findings: optional(formData.get('findings'), 4000),
    result,
    next_service_due: nextDue,
  });
  if (error) return fail(error);

  revalidatePath('/admin');
  revalidatePath('/admin/service');
  revalidatePath('/admin/leidere');
  revalidatePath(`/minside/leider/${ladderId}`);
  return ok(`Servicerapporten er lagret. Neste frist: ${dato(nextDue)}.`);
}

// ── Ukoblede vedlikeholdsrapporter ─────────────────────────────────────────

/**
 * Kobler en innsendt rapport til riktig leider.
 *
 * Det åpne skjemaet tar imot hvilket som helst produksjonsnummer og lagrer
 * råteksten selv når oppslaget bommer. Her ryddes de bommene opp.
 */
export async function linkMaintenanceLog(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const logId = uuid(formData.get('log_id'));
  const ladderId = uuid(formData.get('ladder_id'));
  if (!logId || !ladderId) return err('Velg en leider.');

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, vessel_id')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return err('Fant ikke leideren.');

  const { error } = await supabase
    .from('maintenance_logs')
    .update({ ladder_id: ladder.id, vessel_id: ladder.vessel_id })
    .eq('id', logId);
  if (error) return fail(error);

  revalidatePath('/admin');
  revalidatePath('/admin/vedlikehold');
  revalidatePath(`/minside/leider/${ladder.id}`);
  return ok('Rapporten er koblet til leideren.');
}
