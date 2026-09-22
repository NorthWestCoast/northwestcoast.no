import { ConsoleProvider } from './console';
import { ResendProvider } from './resend';
import type { MailMessage, MailProvider, MailResult } from './types';
import { createServiceSupabase, hasServiceRole } from '@/lib/supabase/server';

export type { MailMessage, MailProvider, MailResult } from './types';

export const CONTACT_EMAIL = process.env.CONTACT_TO_EMAIL ?? 'arve@astep.no';
export const ORDER_EMAIL = process.env.ORDER_TO_EMAIL ?? CONTACT_EMAIL;
export const MAINTENANCE_EMAIL = process.env.MAINTENANCE_TO_EMAIL ?? CONTACT_EMAIL;
export const SUPPORT_PHONE = '+47 904 07 341';

/**
 * Velger leverandør ut fra MAIL_PROVIDER.
 *
 * Å bytte til Brevo: legg til lib/mail/brevo.ts som implementerer
 * MailProvider, ta den inn i switchen under, og sett MAIL_PROVIDER=brevo.
 * Ingen andre filer trenger å endres.
 */
function selectProvider(): MailProvider | null {
  const provider = (process.env.MAIL_PROVIDER ?? 'resend').toLowerCase();
  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no';

  switch (provider) {
    case 'resend': {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) return new ResendProvider(apiKey, from);
      break;
    }
    // case 'brevo': { ... }
    default:
      console.warn(`[mail] Ukjent MAIL_PROVIDER "${provider}".`);
  }

  // Ingen nøkkel: i utvikling logger vi, i produksjon skal det feile synlig.
  if (process.env.NODE_ENV !== 'production') return new ConsoleProvider();
  return null;
}

type SendOptions = {
  /** Navn på malen. Lagres i email_log for statistikk og feilsøking. */
  template: string;
  relatedType?: string;
  relatedId?: string;
};

/**
 * Sender en e-post og logger forsøket i email_log.
 *
 * Loggingen er «best effort»: klarer vi ikke å skrive loggraden, skal
 * e-posten likevel sendes. Selve leveransen er viktigere enn sporingen.
 */
export async function sendMail(
  message: MailMessage,
  options: SendOptions,
): Promise<MailResult> {
  const provider = selectProvider();

  if (!provider) {
    const error = 'Ingen e-postleverandør konfigurert (mangler RESEND_API_KEY).';
    console.error(`[mail] ${error}`);
    await logEmail({ ...options, message, provider: 'none', result: { ok: false, error } });
    return { ok: false, error };
  }

  const result = await provider.send(message);

  if (!result.ok) {
    console.error(`[mail] ${options.template} feilet: ${result.error}`);
  }

  await logEmail({ ...options, message, provider: provider.name, result });
  return result;
}

async function logEmail(args: {
  template: string;
  relatedType?: string;
  relatedId?: string;
  message: MailMessage;
  provider: string;
  result: MailResult;
}) {
  if (!hasServiceRole()) return;

  try {
    const supabase = createServiceSupabase();
    await supabase.from('email_log').insert({
      to_email: args.message.to,
      template: args.template,
      provider: args.provider,
      provider_message_id: args.result.ok ? args.result.id : null,
      status: args.result.ok ? 'sent' : 'failed',
      error: args.result.ok ? null : args.result.error,
      attempts: 1,
      related_type: args.relatedType ?? null,
      related_id: args.relatedId ?? null,
      sent_at: args.result.ok ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error('[mail] Kunne ikke skrive email_log:', err);
  }
}
