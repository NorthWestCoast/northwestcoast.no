/**
 * Skriver innloggings-e-postene til supabase/templates/.
 *
 *   npm run mail:auth
 *
 * Malene selv står i lib/mail/auth-templates.ts. Kjør på nytt når de endres,
 * og lim resultatet inn i Supabase (se supabase/templates/README.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_TEMPLATES } from '../lib/mail/auth-templates.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'templates');

mkdirSync(OUT, { recursive: true });
for (const template of AUTH_TEMPLATES) {
  writeFileSync(join(OUT, template.file), template.html, 'utf8');
  console.log(`${template.file.padEnd(22)} ${template.supabaseName.padEnd(22)} Emne: ${template.subject}`);
}
