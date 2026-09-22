import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';
import { CONTACT_EMAIL, SUPPORT_PHONE, sendMail } from '@/lib/mail';
import { SITE_URL } from '@/lib/site';

/**
 * Invitasjoner: fra utsendt e-post til faktisk medlemskap.
 *
 * Hvorfor service-role her: en nyinvitert person er ennå ikke medlem av noe
 * selskap. RLS-policyen på company_invitations krever at man allerede er
 * administrator i selskapet – altså kan personen ikke lese sin egen
 * invitasjon. Innløsningen må derfor skje med forhøyede rettigheter, og den
 * eneste inngangen er rett etter en verifisert innlogging.
 */

/**
 * Løser inn alle åpne invitasjoner for en nettopp innlogget bruker.
 *
 * Matchingen skjer på e-postadressen, som Supabase allerede har verifisert
 * ved at brukeren klikket lenken i innboksen sin. Returnerer antall
 * medlemskap som ble opprettet.
 */
export async function redeemInvitations(userId: string, email: string): Promise<number> {
  if (!hasServiceRole()) return 0;

  const supabase = createServiceSupabase();

  const { data: invitations, error } = await supabase
    .from('company_invitations')
    .select('id, company_id, role')
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('[invitations] Kunne ikke hente invitasjoner:', error);
    return 0;
  }
  if (!invitations?.length) return 0;

  let redeemed = 0;

  for (const invitation of invitations) {
    // upsert framfor insert: logger man inn to ganger raskt etter hverandre,
    // skal ikke den andre runden feile på duplikatnøkkel.
    const { error: memberError } = await supabase.from('company_members').upsert(
      { company_id: invitation.company_id, user_id: userId, role: invitation.role },
      { onConflict: 'company_id,user_id' },
    );

    if (memberError) {
      console.error('[invitations] Kunne ikke opprette medlemskap:', memberError);
      continue;
    }

    await supabase
      .from('company_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    redeemed += 1;
  }

  return redeemed;
}

/**
 * Varsler den inviterte. Uten dette vet personen ikke at hun har fått
 * tilgang – raden i databasen hjelper henne ikke.
 */
export async function sendInviteEmail(args: {
  email: string;
  companyName: string;
  invitedBy?: string | null;
}) {
  const from = args.invitedBy ? `${args.invitedBy} hos NorthWest Coast` : 'NorthWest Coast';

  await sendMail(
    {
      to: args.email,
      subject: `Du har fått tilgang til Min side – ${args.companyName}`,
      text: [
        `Hei,`,
        ``,
        `${from} har gitt deg tilgang til Min side for ${args.companyName}.`,
        ``,
        `Der finner du fartøyene deres, registrerte Argostep-leidere,`,
        `servicehistorikk, neste servicedato og vedlikeholdsloggen.`,
        ``,
        `Logg inn her – bruk denne e-postadressen:`,
        `${SITE_URL}/logg-inn`,
        ``,
        `Du trenger ikke passord. Vi sender deg en innloggingslenke.`,
        ``,
        `Spørsmål: ${CONTACT_EMAIL} / ${SUPPORT_PHONE}`,
        ``,
        `Med vennlig hilsen`,
        `NorthWest Coast AS`,
      ].join('\n'),
    },
    { template: 'company_invitation' },
  );
}
