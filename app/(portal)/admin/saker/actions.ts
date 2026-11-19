'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/supabase/staff';
import { type ActionResult, err, fail, ok, text, uuid } from '@/lib/portal/forms';
import { TICKET_CATEGORIES, ticketStatusStaff } from '@/lib/portal/labels';

const STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high'];

function refresh(ticketId: string) {
  revalidatePath(`/admin/saker/${ticketId}`);
  revalidatePath('/admin/saker');
  revalidatePath('/admin', 'layout');
  revalidatePath(`/minside/support/${ticketId}`);
}

/** Svarer kunden. Databasen setter saken til «venter på kunde» og varsler. */
export async function replyTicket(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ticketId = uuid(formData.get('ticket_id'));
  const body = text(formData.get('body'), 5000);
  if (!ticketId) return err('Fant ikke saken.');
  if (!body) return err('Skriv et svar.');

  const { error } = await supabase.rpc('reply_ticket', { p_ticket: ticketId, p_body: body });
  if (error) return fail(error);

  refresh(ticketId);
  return ok('Svaret er sendt.');
}

export async function setTicketStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ticketId = uuid(formData.get('ticket_id'));
  const status = text(formData.get('status'), 20);
  if (!ticketId) return err('Fant ikke saken.');
  if (!STATUSES.includes(status)) return err('Velg en status.');

  const { error } = await supabase.rpc('set_ticket_status', { p_ticket: ticketId, p_status: status });
  if (error) return fail(error);

  refresh(ticketId);
  return ok(`Status er satt til «${ticketStatusStaff(status).label}».`);
}

/** Prioritet og kategori er interne merkelapper og endres direkte. */
export async function setTicketDetails(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();

  const ticketId = uuid(formData.get('ticket_id'));
  const priority = text(formData.get('priority'), 10);
  const category = text(formData.get('category'), 20);
  if (!ticketId) return err('Fant ikke saken.');
  if (!PRIORITIES.includes(priority)) return err('Velg en prioritet.');
  if (!(category in TICKET_CATEGORIES)) return err('Velg en kategori.');

  const { error } = await supabase.from('support_tickets').update({ priority, category }).eq('id', ticketId);
  if (error) return fail(error);

  refresh(ticketId);
  return ok('Prioritet og kategori er lagret.');
}
