'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, isoDate, ok, optional, text, uuid } from '@/lib/portal/forms';
import { idag } from '@/lib/format';

/**
 * Oppbevaringsskap i admin. Skap fra produksjonen opprettes av seg selv når
 * jobben leveres; her registreres skap for hånd, og de knyttes til kunde,
 * fartøy og prosjekt.
 *
 * Alt skrives gjennom administratorens egen sesjon. RLS (app.is_staff()) og
 * place_cabinet() er autorisasjonslaget.
 */

const SERIAL = /^[A-Z0-9][A-Z0-9._/-]{2,39}$/;

function refresh(cabinetId?: string) {
  revalidatePath('/admin/skap');
  if (cabinetId) revalidatePath(`/admin/skap/${cabinetId}`);
  revalidatePath('/admin/selskap', 'layout');
  revalidatePath('/minside', 'layout');
}

/** Nummeret er valgfritt. Tomt gir null, ugyldig gir en feilmelding. */
function readSerial(formData: FormData): { error: string } | { error: null; serial: string | null } {
  const serial = text(formData.get('serial_number'), 60).toUpperCase();
  if (serial && !SERIAL.test(serial)) {
    return { error: `«${serial}» er ikke et gyldig nummer (3–40 tegn: bokstaver, tall, bindestrek).` };
  }
  return { error: null, serial: serial || null };
}

const serialTaken = (error: { code?: string }) => error.code === '23505';

/** Registrerer et skap som ikke kommer fra en produksjonsjobb. */
export async function registerCabinet(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const productId = uuid(formData.get('product_id'));
  if (!productId) return err('Velg hvilken modell skapet er.');

  const parsed = readSerial(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { data: product } = await supabase.from('products').select('id, kind, name').eq('id', productId).maybeSingle();
  if (!product || product.kind !== 'cabinet') return err('Velg et produkt av typen oppbevaringsskap.');

  const { error } = await supabase.from('cabinets').insert({
    product_id: product.id,
    company_id: uuid(formData.get('company_id')),
    serial_number: parsed.serial,
    notes: optional(formData.get('notes'), 2000),
    status: 'delivered',
  });
  if (error) return serialTaken(error) ? err('Det finnes allerede et skap med dette nummeret.') : fail(error);

  refresh();
  return ok(`${product.name} er registrert.`);
}

/**
 * Knytter skapet til en kunde og et sted. Med fartøy og/eller prosjekt
 * plasseres det (kunden følger med); uten tas det ned og blir stående hos
 * kunden som er valgt.
 */
export async function placeCabinet(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const cabinetId = uuid(formData.get('cabinet_id'));
  if (!cabinetId) return err('Fant ikke skapet.');

  const companyId = uuid(formData.get('company_id'));
  const vesselId = uuid(formData.get('vessel_id'));
  const projectId = uuid(formData.get('project_id'));
  const location = optional(formData.get('location_note'), 200);

  const { data: cabinet } = await supabase.from('cabinets').select('id, status').eq('id', cabinetId).maybeSingle();
  if (!cabinet) return err('Fant ikke skapet.');

  if (!vesselId && !projectId) {
    const { error } = await supabase
      .from('cabinets')
      .update({
        company_id: companyId,
        vessel_id: null,
        project_id: null,
        installed_at: null,
        location_note: location,
        status: cabinet.status === 'installed' ? 'delivered' : cabinet.status,
      })
      .eq('id', cabinetId);
    if (error) return fail(error);

    refresh(cabinetId);
    return ok(companyId ? 'Skapet står hos kunden, ikke plassert.' : 'Skapet er ikke knyttet til noen kunde.');
  }

  const [{ data: vessel }, { data: project }] = await Promise.all([
    vesselId
      ? supabase.from('vessels').select('name, company_id').eq('id', vesselId).maybeSingle()
      : Promise.resolve({ data: null }),
    projectId
      ? supabase.from('projects').select('name, company_id').eq('id', projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (vesselId && !vessel) return err('Fant ikke fartøyet.');
  if (projectId && !project) return err('Fant ikke prosjektet.');
  if (companyId && (vessel ?? project)?.company_id !== companyId) {
    return err(`${vessel ? 'Fartøyet' : 'Prosjektet'} tilhører en annen kunde enn den du valgte.`);
  }

  const today = idag();
  const date = isoDate(formData.get('installed_at')) ?? today;
  if (date > today) return err('Datoen kan ikke ligge fram i tid.');

  // Typene kjenner bare `string` for fartøy og prosjekt, men funksjonen tar
  // null for den av dem som ikke er valgt.
  const { error } = await supabase.rpc('place_cabinet', {
    p_cabinet: cabinetId,
    p_vessel: vesselId as string,
    p_project: projectId as string,
    p_installed_at: date,
    p_location: location ?? undefined,
  });
  if (error) return fail(error, 'Plasseringen kunne ikke lagres.');

  refresh(cabinetId);
  return ok(`Skapet er plassert: ${[vessel?.name, project?.name].filter(Boolean).join(' · ')}.`);
}

/** Nummer og internt notat. */
export async function updateCabinet(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const cabinetId = uuid(formData.get('cabinet_id'));
  if (!cabinetId) return err('Fant ikke skapet.');

  const parsed = readSerial(formData);
  if (parsed.error !== null) return err(parsed.error);

  const { error } = await supabase
    .from('cabinets')
    .update({ serial_number: parsed.serial, notes: optional(formData.get('notes'), 2000) })
    .eq('id', cabinetId);
  if (error) return serialTaken(error) ? err('Det finnes allerede et skap med dette nummeret.') : fail(error);

  refresh(cabinetId);
  return ok('Opplysningene er lagret.');
}

/**
 * Setter skapet som utrangert, eller tar det i bruk igjen. Et utrangert skap
 * tas ned fra fartøyet og prosjektet, og vises ikke lenger hos kunden.
 */
export async function setCabinetRetired(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const cabinetId = uuid(formData.get('cabinet_id'));
  if (!cabinetId) return err('Fant ikke skapet.');
  const retire = formData.get('retired') === 'true';

  const { error } = await supabase
    .from('cabinets')
    .update(
      retire
        ? { status: 'retired', vessel_id: null, project_id: null, installed_at: null }
        : { status: 'delivered' },
    )
    .eq('id', cabinetId);
  if (error) return fail(error);

  refresh(cabinetId);
  return ok(retire ? 'Skapet er satt som utrangert.' : 'Skapet står som levert igjen og kan plasseres.');
}
