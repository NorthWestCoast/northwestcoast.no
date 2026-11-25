'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { finishMaintenance } from '@/lib/maintenance/finish';
import { checklistPayload, isChecklist } from '@/lib/maintenance-checklists';
import { getDict, isLang, type Lang } from '@/lib/i18n';
import { LINK_TOKEN } from '@/components/minside/maintenance-links';
import type { FinishResult, RegisterInput, RegisterResult } from '@/components/maintenance-checklist-form';
import type { UploadedFile } from '@/components/portal/photo-uploader';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const langOf = (value: unknown): Lang => (typeof value === 'string' && isLang(value) ? value : 'no');
const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Registrering via lenke, uten innlogging. Bundet på serveren:
 * `submitViaLink.bind(null, token, lang)`.
 *
 * Alt som gjelder leideren, hentes av databasen fra lenken. Her bygges bare
 * punktene (teksten slik skjemaet viste dem), og resten sendes videre.
 * submit_maintenance_via_link() sjekker lenken, datoen og antallet per døgn.
 */
export async function submitViaLink(token: string, rawLang: string, input: RegisterInput): Promise<RegisterResult> {
  const lang = langOf(rawLang);
  const t = getDict(lang).maintenanceForm;
  if (!LINK_TOKEN.test(token ?? '')) return { ok: false, error: t.link.invalidTitle };

  const checklist = input?.checklist ?? null;
  if (checklist !== null && !isChecklist(checklist)) return { ok: false, error: t.failed };
  const paper = checklist !== null && input.paperForm === true;
  const performedAt = str(input.performedAt, 10);

  const payload = {
    name: str(input.name, 120),
    email: str(input.email, 160),
    checklist,
    items: checklist && !paper ? checklistPayload(lang, checklist, input.checked) : [],
    paper_form: paper,
    performed_at: DATE.test(performedAt) ? performedAt : '',
    title: checklist ? '' : str(input.title, 160),
    notes: str(input.notes, 4000),
  };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('submit_maintenance_via_link', { p_token: token, payload });

  const logId =
    data && typeof data === 'object' && !Array.isArray(data) && typeof data.log_id === 'string' ? data.log_id : null;

  if (error || !logId) {
    // Databasens egne avslag (P0001) er skrevet på norsk og kan vises som de er.
    if (error?.code === 'P0001') return { ok: false, error: lang === 'no' ? error.message : t.failed };
    console.error('[registrer] Kunne ikke lagre via lenke:', error?.code, error?.message);
    return { ok: false, error: t.failed };
  }
  return { ok: true, logId };
}

/** Knytter bildene til registreringen og sender kvittering. */
export async function finishViaLink(rawLang: string, logId: string, photos: UploadedFile[]): Promise<FinishResult> {
  const id = typeof logId === 'string' ? logId.toLowerCase() : '';
  if (!UUID.test(id)) return { ok: false };

  const paths = (Array.isArray(photos) ? photos : [])
    .map((photo) => (photo && typeof photo.path === 'string' ? photo.path.trim() : ''))
    .filter((path) => path.length > 0 && path.length <= 200 && path.startsWith(`${id}/`))
    .slice(0, 10);

  const supabase = await createServerSupabase();
  const result = await finishMaintenance(supabase, id, paths, langOf(rawLang));
  return { ok: result.ok, receipt: result.receipt };
}
