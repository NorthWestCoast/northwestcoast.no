/**
 * Leverandøruavhengig e-postgrensesnitt.
 *
 * Alt som sender e-post går gjennom MailProvider. Å bytte fra Resend til
 * Brevo (eller Scaleway TEM, eller SES) er da én ny fil som implementerer
 * dette grensesnittet, pluss en endret miljøvariabel – ingen kallsteder
 * må røres.
 */

export type MailAttachment = {
  filename: string;
  /** base64 uten data-URL-prefiks */
  content: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
};

export type MailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export interface MailProvider {
  /** Kort navn, lagres i email_log.provider for sporbarhet. */
  readonly name: string;
  send(message: MailMessage): Promise<MailResult>;
}
