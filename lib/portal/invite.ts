import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { PortalContext } from './context';
import { type ActionResult, err, fail, isEmail, ok } from './forms';
import { CONTACT_EMAIL, sendMail } from '@/lib/mail';
import { accessInvitation } from '@/lib/mail/templates';

type Scope =
  | { scope: 'company'; id: string; role: 'owner' | 'admin' | 'member' }
  | { scope: 'vessel'; id: string; role: 'master' | 'crew' | 'viewer' }
  | { scope: 'ladder'; id: string; role: 'manager' | 'viewer' };

/**
 * Inviterer en person til et selskap, et fartøy eller en leider.
 *
 * Raden skrives med innloggerens egen sesjon, så RLS avgjør om hun har lov.
 * Tilgangen gjelder først når den inviterte har logget inn med samme
 * e-postadresse og godtatt invitasjonen på Min side. E-posten er bare et
 * varsel: uten e-postleverandør virker invitasjonen likevel, og kvitteringen
 * sier ærlig om varselet gikk ut.
 */
export async function createInvitation(
  supabase: SupabaseClient<Database>,
  ctx: PortalContext,
  args: Scope & { email: string; targetName: string; message?: string | null },
): Promise<ActionResult> {
  const email = args.email.trim().toLowerCase();
  if (!isEmail(email)) return err('E-postadressen ser ikke gyldig ut.');
  if (email === ctx.email.toLowerCase()) return err('Du kan ikke invitere deg selv.');

  const { error } = await supabase.from('access_invitations').insert({
    email,
    scope: args.scope,
    company_id: args.scope === 'company' ? args.id : null,
    vessel_id: args.scope === 'vessel' ? args.id : null,
    ladder_id: args.scope === 'ladder' ? args.id : null,
    role: args.role,
    message: args.message || null,
    invited_by: ctx.userId,
    invited_by_name: ctx.displayName,
  });

  if (error) {
    if (error.code === '23505') return err(`${email} har allerede en invitasjon som venter.`);
    return fail(error, 'Invitasjonen kunne ikke lagres.');
  }

  const mail = await sendMail(
    {
      to: email,
      replyTo: CONTACT_EMAIL,
      ...accessInvitation({ inviterEmail: ctx.email, inviterName: ctx.displayName, targetName: args.targetName }),
    },
    { template: 'access_invitation' },
  );

  return ok(
    mail.ok
      ? `${email} er invitert og varslet på e-post. Tilgangen gjelder når invitasjonen er godtatt.`
      : `${email} er invitert, og godtar invitasjonen på Min side etter innlogging. E-postvarselet ble ikke sendt, så gi gjerne beskjed selv.`,
  );
}
