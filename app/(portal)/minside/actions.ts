'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/portal/context';
import {
  type ActionResult, digits, err, fail, isoDate, ok, optional, text, uuid,
} from '@/lib/portal/forms';
import { idag } from '@/lib/format';
import type { Json } from '@/lib/supabase/database.types';

/**
 * Handlinger som brukes fra flere sider på Min side.
 *
 * Alt går gjennom brukerens egen sesjon. RLS og funksjonene i databasen
 * avgjør hva hun får lov til; koden her validerer bare nok til å gi en
 * forståelig feilmelding.
 */

/** Etter en endring kan både menyen (tellere) og flere sider være utdatert. */
function refresh() {
  revalidatePath('/minside', 'layout');
}

/** Registrerer et selskap. Den som registrerer blir eier. */
export async function createCompany(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const name = text(formData.get('name'), 160);
  if (name.length < 2) return err('Skriv inn navnet på selskapet.');

  const orgNumber = digits(formData.get('org_number'));
  if (orgNumber && orgNumber.length !== 9) return err('Organisasjonsnummeret skal ha 9 siffer.');

  const { error } = await supabase.rpc('create_my_company', {
    p_name: name,
    p_org_number: orgNumber || undefined,
    p_address: optional(formData.get('address')) ?? undefined,
    p_postal_code: optional(formData.get('postal_code'), 10) ?? undefined,
    p_city: optional(formData.get('city'), 80) ?? undefined,
    p_contact_phone: optional(formData.get('phone'), 40) ?? undefined,
  });
  if (error) return fail(error, 'Selskapet kunne ikke registreres.');

  refresh();
  return ok(`${name} er registrert, og du er eier. Nå kan du legge til fartøy og invitere kolleger.`);
}

/** Ber om tilgang til en leider via produksjonsnummeret. */
export async function requestLadderAccess(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const serial = text(formData.get('serial'), 60);
  if (serial.length < 3) return err('Skriv inn produksjonsnummeret som står på leideren.');

  const { data, error } = await supabase.rpc('request_ladder_access', {
    p_serial: serial,
    p_message: optional(formData.get('message'), 1000) ?? undefined,
  });
  if (error) return fail(error, 'Forespørselen kunne ikke sendes.');

  const result: Record<string, Json | undefined> =
    data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  refresh();

  switch (result.status) {
    case 'not_found':
      return err('Vi fant ingen leider med dette produksjonsnummeret. Sjekk nummeret på merkeskiltet og prøv igjen.');
    case 'already':
      return ok('Du har allerede tilgang til denne leideren. Du finner den under Leidere.');
    case 'pending':
      return ok('Du har allerede en forespørsel på denne leideren som venter på svar.');
    case 'requested':
      return ok(
        result.handled_by === 'owner'
          ? 'Forespørselen er sendt. Eieren av leideren avgjør om du får tilgang, og du får varsel når det er avklart.'
          : 'Forespørselen er sendt. Leideren har ingen registrert eier ennå, så NorthWest Coast behandler den. Du får varsel når det er avklart.',
      );
    default:
      return err('Forespørselen kunne ikke sendes. Prøv igjen.');
  }
}

/** Godkjenner eller avslår en forespørsel om tilgang til en leider. */
export async function decideAccessRequest(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const requestId = uuid(formData.get('request_id'));
  if (!requestId) return err('Fant ikke forespørselen.');

  const approve = formData.get('approve') === 'true';
  const role = text(formData.get('role'), 20) === 'manager' ? 'manager' : 'viewer';

  const { error } = await supabase.rpc('decide_ladder_access', {
    p_request: requestId,
    p_approve: approve,
    p_role: role,
    p_note: optional(formData.get('note'), 500) ?? undefined,
  });
  if (error) return fail(error, 'Forespørselen kunne ikke behandles.');

  refresh();
  return ok(approve ? 'Tilgangen er gitt.' : 'Forespørselen er avslått.');
}

/** Trekker tilbake en invitasjon som ikke er tatt i bruk ennå. */
export async function revokeInvitation(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const invitationId = uuid(formData.get('invitation_id'));
  if (!invitationId) return err('Fant ikke invitasjonen.');

  const { data, error } = await supabase
    .from('access_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id');
  if (error) return fail(error, 'Invitasjonen kunne ikke trekkes tilbake.');
  // RLS filtrerer bort raden framfor å kaste feil når man mangler rettigheter.
  if (!data?.length) return err('Invitasjonen er allerede brukt eller trukket tilbake.');

  refresh();
  return ok('Invitasjonen er trukket tilbake.');
}

/** Bestiller service på en leider. */
export async function requestService(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Velg hvilken leider det gjelder.');

  const preferred = isoDate(formData.get('preferred_date'));
  if (text(formData.get('preferred_date'), 12) && !preferred) return err('Datoen er ikke gyldig.');

  const { error } = await supabase.rpc('request_service', {
    p_ladder: ladderId,
    p_preferred_date: preferred ?? undefined,
    p_location: optional(formData.get('location'), 200) ?? undefined,
    p_notes: optional(formData.get('notes'), 2000) ?? undefined,
  });
  if (error) return fail(error, 'Servicebestillingen kunne ikke sendes.');

  refresh();
  return ok('Service er bestilt. NorthWest Coast tar kontakt for å avtale tidspunkt.');
}

/** Avbestiller en servicebestilling som ikke er utført. */
export async function cancelServiceBooking(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const bookingId = uuid(formData.get('booking_id'));
  if (!bookingId) return err('Fant ikke bestillingen.');

  const { error } = await supabase.rpc('cancel_service_booking', { p_booking: bookingId });
  if (error) return fail(error, 'Bestillingen kunne ikke avbestilles.');

  refresh();
  return ok('Servicebestillingen er avbestilt.');
}

// ── Plassering av leidere og oppbevaringsskap ──────────────────────────────

/**
 * Fartøy og prosjekt er valgfrie i install_ladder() og place_cabinet(): null
 * betyr «ikke på et fartøy» / «ikke i et prosjekt». De genererte typene
 * kjenner bare `string`, derfor omformingen.
 */
const orNull = (id: string | null) => id as string;

/** Leser fartøy, prosjekt og dato fra plasseringsskjemaet (components/portal/placement.tsx). */
function readPlacement(formData: FormData):
  | { error: string }
  | { error: null; vesselId: string | null; projectId: string | null; date: string } {
  const vesselId = uuid(formData.get('vessel_id'));
  const projectId = uuid(formData.get('project_id'));
  if (!vesselId && !projectId) return { error: 'Velg et fartøy, et prosjekt eller begge.' };

  const today = idag();
  const date = isoDate(formData.get('installed_at')) ?? today;
  if (date > today) return { error: 'Datoen kan ikke ligge fram i tid.' };

  return { error: null, vesselId, projectId, date };
}

/**
 * Plasserer en leider på et fartøy, i et prosjekt (kai, anlegg på land) eller
 * begge. Leideren regnes som i bruk, og servicefristen løper fra datoen.
 */
export async function installLadder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Fant ikke leideren.');

  const place = readPlacement(formData);
  if (place.error !== null) return err(place.error);

  const { error } = await supabase.rpc('install_ladder', {
    p_ladder: ladderId,
    p_vessel: orNull(place.vesselId),
    p_installed_at: place.date,
    p_project: place.projectId ?? undefined,
  });
  if (error) return fail(error, 'Plasseringen kunne ikke lagres.');

  refresh();
  return ok('Plasseringen er lagret. Servicefristen regnes fra datoen leideren ble tatt i bruk.');
}

/** Tar en leider ned fra fartøyet og ut av prosjektet. Den står da som levert. */
export async function takeDownLadder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ladderId = uuid(formData.get('ladder_id'));
  if (!ladderId) return err('Fant ikke leideren.');

  const { error } = await supabase.rpc('install_ladder', { p_ladder: ladderId, p_vessel: orNull(null) });
  if (error) return fail(error, 'Leideren kunne ikke tas ned.');

  refresh();
  return ok('Leideren er tatt ned og står som levert.');
}

/** Plasserer eller flytter et oppbevaringsskap: fartøy og/eller prosjekt, dato og nøyaktig sted. */
export async function placeCabinet(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const cabinetId = uuid(formData.get('cabinet_id'));
  if (!cabinetId) return err('Fant ikke skapet.');

  const place = readPlacement(formData);
  if (place.error !== null) return err(place.error);

  const { error } = await supabase.rpc('place_cabinet', {
    p_cabinet: cabinetId,
    p_vessel: orNull(place.vesselId),
    p_project: orNull(place.projectId),
    p_installed_at: place.date,
    p_location: optional(formData.get('location_note'), 200) ?? undefined,
  });
  if (error) return fail(error, 'Plasseringen kunne ikke lagres.');

  refresh();
  return ok('Plasseringen er lagret.');
}

/** Tar et oppbevaringsskap ned. Det står da som levert, ikke plassert. */
export async function takeDownCabinet(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const cabinetId = uuid(formData.get('cabinet_id'));
  if (!cabinetId) return err('Fant ikke skapet.');

  const { error } = await supabase.rpc('place_cabinet', {
    p_cabinet: cabinetId,
    p_vessel: orNull(null),
    p_project: orNull(null),
  });
  if (error) return fail(error, 'Skapet kunne ikke tas ned.');

  refresh();
  return ok('Skapet er tatt ned og står som ikke plassert.');
}
