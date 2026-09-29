import { DEFAULT_LANG, isLang, type Lang } from './i18n';

// Felles e-postutsending via Resend. Returnerer false hvis e-post ikke er
// konfigurert, slik at API-rutene kan si fra i stedet for å miste en henvendelse.
type Attachment = { filename: string; content: string };

export const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? 'arve@astep.no';
export const CONTACT_PHONE = '+47 904 07 341';

/** Sikrer at et vilkårlig felt fra klienten blir et gyldig språk. */
export function resolveLang(value: unknown): Lang {
  return typeof value === 'string' && isLang(value) ? value : DEFAULT_LANG;
}

export function notConfiguredMessage(lang: Lang): string {
  return lang === 'en'
    ? `We could not send the form automatically. Please call ${CONTACT_PHONE} or email ${CONTACT_TO_EMAIL} and we will help you right away.`
    : `Vi fikk ikke sendt skjemaet automatisk. Ring ${CONTACT_PHONE} eller send e-post til ${CONTACT_TO_EMAIL}, så hjelper vi deg med én gang.`;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@northwestcoast.no',
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    replyTo: opts.replyTo,
    attachments: opts.attachments?.length ? opts.attachments : undefined,
  });

  if (error) throw new Error(error.message);
  return true;
}
