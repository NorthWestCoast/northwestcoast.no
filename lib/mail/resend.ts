import type { MailMessage, MailProvider, MailResult } from './types';

/** Resend-implementasjonen av MailProvider. */
export class ResendProvider implements MailProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(this.apiKey);

      const result = await resend.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(message.attachments?.length
          ? { attachments: message.attachments }
          : {}),
      });

      if (result.error) {
        return { ok: false, error: result.error.message ?? String(result.error) };
      }
      return { ok: true, id: result.data?.id ?? null };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
