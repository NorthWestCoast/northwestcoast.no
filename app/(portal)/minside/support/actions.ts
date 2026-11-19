'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/portal/context';
import { type ActionResult, err, fail, ok, text, uuid } from '@/lib/portal/forms';
import { TICKET_CATEGORIES } from '@/lib/portal/labels';

function refresh() {
  revalidatePath('/minside', 'layout');
}

/** Oppretter en sak og sender brukeren til tråden. */
export async function createTicket(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const subject = text(formData.get('subject'), 200);
  if (subject.length < 3) return err('Skriv et kort emne.');

  const body = text(formData.get('body'), 5000);
  if (!body) return err('Beskriv hva saken gjelder.');

  const category = text(formData.get('category'), 20);
  if (!Object.hasOwn(TICKET_CATEGORIES, category)) return err('Velg en kategori.');

  const { data: ticketId, error } = await supabase.rpc('create_ticket', {
    p_subject: subject,
    p_body: body,
    p_category: category,
    p_ladder: uuid(formData.get('ladder_id')) ?? undefined,
  });
  if (error || !ticketId) return fail(error, 'Saken kunne ikke opprettes.');

  refresh();
  redirect(`/minside/support/${ticketId}`);
}

export async function replyTicket(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ticketId = uuid(formData.get('ticket_id'));
  if (!ticketId) return err('Fant ikke saken.');

  const body = text(formData.get('body'), 5000);
  if (!body) return err('Skriv en melding.');

  const { error } = await supabase.rpc('reply_ticket', { p_ticket: ticketId, p_body: body });
  if (error) return fail(error, 'Meldingen kunne ikke sendes.');

  refresh();
  return ok('Meldingen er sendt.');
}

/** Kunden kan lukke og gjenåpne egne saker. */
export async function setTicketStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const ticketId = uuid(formData.get('ticket_id'));
  if (!ticketId) return err('Fant ikke saken.');

  const status = formData.get('status') === 'closed' ? 'closed' : 'open';

  const { error } = await supabase.rpc('set_ticket_status', { p_ticket: ticketId, p_status: status });
  if (error) return fail(error, 'Statusen kunne ikke endres.');

  refresh();
  return ok(status === 'closed' ? 'Saken er lukket.' : 'Saken er åpnet igjen.');
}
