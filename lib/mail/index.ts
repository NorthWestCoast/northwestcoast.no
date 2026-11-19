import { ConsoleProvider } from './console';
import { ResendProvider } from './resend';
import { sender } from './config';
import type { MailMessage, MailProvider, MailResult } from './types';

export type { MailMessage, MailProvider, MailResult } from './types';

export { CONTACT_EMAIL, MAINTENANCE_EMAIL, ORDER_EMAIL, SUPPORT_PHONE } from './config';

/**
 * Velger leverandør ut fra MAIL_PROVIDER.
 *
 * Å bytte til Brevo: legg til lib/mail/brevo.ts som implementerer
 * MailProvider, ta den inn i switchen under, og sett MAIL_PROVIDER=brevo.
 * Ingen andre filer trenger å endres.
 */
function selectProvider(): MailProvider | null {
  const provider = (process.env.MAIL_PROVIDER ?? 'resend').toLowerCase();
  const from = sender();

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
  /** Navn på malen. Står i feilloggen, så en feilet utsending kan spores. */
  template: string;
  /** Hva e-posten gjelder (f.eks. 'order' og ordrens id). Kun til feilsøking. */
  relatedType?: string;
  relatedId?: string;
};

/**
 * Sender en e-post.
 *
 * Kaster aldri: resultatet sier om utsendingen lyktes, og kalleren avgjør hva
 * det betyr. E-post er et tillegg til det som allerede er lagret i databasen,
 * så en feil her skal aldri velte en bestilling eller en rapport.
 */
export async function sendMail(
  message: MailMessage,
  options: SendOptions,
): Promise<MailResult> {
  const provider = selectProvider();

  if (!provider) {
    const error = 'Ingen e-postleverandør konfigurert (mangler RESEND_API_KEY).';
    console.error(`[mail] ${options.template}: ${error}`);
    return { ok: false, error };
  }

  try {
    const result = await provider.send(message);
    if (!result.ok) {
      const about = options.relatedId ? ` (${options.relatedType ?? 'id'} ${options.relatedId})` : '';
      console.error(`[mail] ${options.template} feilet${about}: ${result.error}`);
    }
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[mail] ${options.template} feilet: ${error}`);
    return { ok: false, error };
  }
}
