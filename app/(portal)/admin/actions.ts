'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { createInvitation } from '@/lib/portal/invite';
import {
  type ActionResult, digits, err, fail, isEmail, isoDate, ok, optional, text, uuid,
} from '@/lib/portal/forms';
import { readVessel, vesselError } from '@/components/portal/vessel-values';

/**
 * Server actions som brukes fra flere admin-sider: selskap, fartøy, tilgang,
 * leidere og kobling av vedlikeholdsrapporter. Registrering av service ligger
 * i service/actions.ts.
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

/**
 * Oppretter en kunde, og – når fartøyfeltene i skjemaet er fylt ut
 * («Finn kunde via fartøy») – det første fartøyet i samme arbeidsflyt.
 * Etterpå åpnes kunden, der neste steg er å invitere en kontaktperson.
 */
export async function createCompany(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const fields = companyFields(formData);
  if (!fields.name) return err('Navn er påkrevd.');
  if (fields.contact_email && !isEmail(fields.contact_email)) return err('E-postadressen ser ikke gyldig ut.');

  // Fartøyet kontrolleres før kunden opprettes, så en tastefeil i fartøyet
  // ikke etterlater en halvferdig kunde.
  const withVessel = text(formData.get('vessel_name'), 160) !== '';
  const vessel = withVessel ? readVessel(formData, 'vessel_') : null;
  if (vessel && vessel.error !== null) return err(vessel.error);
  if (vessel?.values.imo) {
    const { data: taken } = await supabase
      .from('vessels')
      .select('name, companies(name)')
      .eq('imo', vessel.values.imo)
      .maybeSingle();
    if (taken) {
      return err(
        `IMO ${vessel.values.imo} er allerede registrert på ${taken.name}${taken.companies ? ` (${taken.companies.name})` : ''}. Fjern fartøyet fra skjemaet, eller rett IMO-nummeret.`,
      );
    }
  }

  const { data: company, error } = await supabase.from('companies').insert(fields).select('id').single();
  if (error || !company) return error ? companyError(error, fields.org_number) : fail(error);

  let vesselFailed = false;
  if (vessel) {
    const { error: vesselInsertError } = await supabase
      .from('vessels')
      .insert({ company_id: company.id, ...vessel.values });
    if (vesselInsertError) {
      console.error('[admin] Kunden ble opprettet, men ikke fartøyet:', vesselInsertError.code, vesselInsertError.message);
      vesselFailed = true;
    }
  }

  revalidatePath('/admin/selskap');
  redirect(`/admin/selskap/${company.id}${vesselFailed ? '?fartoy=feilet' : ''}`);
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
  if (!companyId) return err('Fant ikke selskapet.');

  const parsed = readVessel(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { error } = await supabase.from('vessels').insert({ company_id: companyId, ...parsed.values });
  if (error) return vesselError(error, 'Fartøyet kunne ikke lagres.');

  revalidatePath(`/admin/selskap/${companyId}`);
  revalidatePath('/admin/selskap');
  revalidatePath('/minside', 'layout');
  return ok(`${parsed.values.name} er lagt til.`);
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
 * Knytter en leider til en kunde og et sted: selskap, fartøy, prosjekt (kai,
 * anlegg på land) eller flere av dem.
 *
 * Velges et fartøy eller et prosjekt, settes plasseringen akkurat slik den er
 * valgt, og selskapet følger med (trigger i databasen). Med dato regnes
 * leideren som i bruk, og servicefristen begynner å løpe; uten dato er den
 * levert, men ikke tatt i bruk. Velges bare selskap, tas leideren ned hvis
 * den står hos et annet selskap.
 *
 * Skjemaet på leidersiden viser plasseringen leideren har, og sender
 * `exact`: da betyr tomt fartøy og tomt prosjekt at leideren skal tas ned.
 * I skjemaet på leiderlista betyr tomme felt bare «ikke valgt».
 */
export async function assignLadder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ladderId = uuid(formData.get('ladder_id'));
  const companyId = uuid(formData.get('company_id'));
  const vesselId = uuid(formData.get('vessel_id'));
  const projectId = uuid(formData.get('project_id'));
  const installedAt = isoDate(formData.get('installed_at'));
  const exact = formData.get('exact') === 'true';

  if (!ladderId) return err('Velg en leider.');
  if (!companyId && !vesselId && !projectId) return err('Velg et selskap, et fartøy eller et prosjekt.');

  const { data: ladder } = await supabase
    .from('ladders')
    .select('id, status, company_id, vessel_id, project_id')
    .eq('id', ladderId)
    .maybeSingle();
  if (!ladder) return err('Fant ikke leideren.');

  let message: string;
  let error: { code?: string; message: string } | null;

  if (vesselId || projectId) {
    const [{ data: vessel }, { data: project }] = await Promise.all([
      vesselId
        ? supabase.from('vessels').select('id, name, company_id').eq('id', vesselId).maybeSingle()
        : Promise.resolve({ data: null }),
      projectId
        ? supabase.from('projects').select('id, name, company_id').eq('id', projectId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (vesselId && !vessel) return err('Fant ikke fartøyet.');
    if (projectId && !project) return err('Fant ikke prosjektet.');
    if (vessel && project && vessel.company_id !== project.company_id) {
      return err('Fartøyet og prosjektet tilhører ulike selskap.');
    }
    if (companyId && (vessel ?? project)?.company_id !== companyId) {
      return err(`${vessel ? 'Fartøyet' : 'Prosjektet'} tilhører et annet selskap enn det du valgte.`);
    }

    ({ error } = await supabase
      .from('ladders')
      .update({
        vessel_id: vesselId,
        project_id: projectId,
        installed_at: installedAt,
        status: installedAt ? 'installed' : 'delivered',
      })
      .eq('id', ladderId));

    const where = [vessel?.name, project?.name].filter(Boolean).join(' · ');
    message = installedAt
      ? `Leideren er tatt i bruk: ${where}.`
      : `Leideren er knyttet til ${where} (levert, ikke tatt i bruk).`;
  } else {
    // Bare selskap: leideren kan ikke bli stående på et fartøy eller i et
    // prosjekt som tilhører et annet selskap.
    const moves = ladder.company_id !== companyId;
    const leaves = (ladder.vessel_id !== null || ladder.project_id !== null) && (exact || moves);

    ({ error } = await supabase
      .from('ladders')
      .update(
        leaves
          ? {
              company_id: companyId,
              vessel_id: null,
              project_id: null,
              status: ladder.status === 'installed' ? 'delivered' : ladder.status,
            }
          : { company_id: companyId },
      )
      .eq('id', ladderId));
    message = !leaves
      ? 'Leideren er knyttet til selskapet.'
      : moves
        ? 'Leideren er flyttet til selskapet og tatt ned fra der den sto.'
        : 'Leideren er tatt ned. Den står fortsatt hos selskapet.';
  }

  if (error) return fail(error);

  revalidatePath('/admin/leidere');
  revalidatePath('/admin');
  revalidatePath('/minside', 'layout');
  return ok(message);
}

// ── Ukoblede vedlikeholdsrapporter ─────────────────────────────────────────

/**
 * Kobler en innsendt rapport til riktig leider.
 *
 * Det åpne skjemaet tar imot hvilket som helst produksjonsnummer og lagrer
 * råteksten selv når oppslaget bommer. Her ryddes de bommene opp.
 */
export async function linkMaintenanceLog(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireStaff();

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
    // Å koble meldingen til en leider er samtidig å bekrefte den: da teller
    // den som vedlikehold og kan vises for los.
    .update({ ladder_id: ladder.id, vessel_id: ladder.vessel_id, verified_at: new Date().toISOString(), verified_by: ctx.userId })
    .eq('id', logId);
  if (error) return fail(error);

  revalidatePath('/admin');
  revalidatePath('/admin/vedlikehold');
  revalidatePath(`/minside/leider/${ladder.id}`);
  return ok('Rapporten er koblet til leideren.');
}

/**
 * Bekrefter en melding fra det åpne vedlikeholdsskjemaet. Skjemaet krever
 * ikke innlogging, så meldingen teller ikke som vedlikehold og vises ikke i
 * rapporter til los før NorthWest Coast har sett over den.
 */
export async function verifyMaintenanceLog(formData: FormData): Promise<ActionResult> {
  const { supabase, ctx } = await requireStaff();

  const logId = uuid(formData.get('log_id'));
  if (!logId) return err('Fant ikke meldingen.');

  const { data, error } = await supabase
    .from('maintenance_logs')
    .update({ verified_at: new Date().toISOString(), verified_by: ctx.userId })
    .eq('id', logId)
    .is('verified_at', null)
    .select('ladder_id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return err('Meldingen er allerede bekreftet.');

  revalidatePath('/admin/vedlikehold');
  if (data.ladder_id) revalidatePath(`/minside/leider/${data.ladder_id}`);
  return ok('Meldingen er bekreftet og teller nå som vedlikehold.');
}
