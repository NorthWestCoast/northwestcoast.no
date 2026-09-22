import type { MailMessage, MailProvider, MailResult } from './types';

/**
 * Utviklingsleverandør: skriver e-posten til konsollen i stedet for å sende.
 *
 * Brukes når ingen API-nøkkel er satt og vi IKKE er i produksjon. I produksjon
 * feiler vi heller enn å late som – en bestilling som forsvinner stille er
 * verre enn en synlig feil.
 */
export class ConsoleProvider implements MailProvider {
  readonly name = 'console';

  async send(message: MailMessage): Promise<MailResult> {
    console.info(
      `[mail:dev] til=${message.to} emne="${message.subject}"\n${message.text}`,
    );
    return { ok: true, id: null };
  }
}
