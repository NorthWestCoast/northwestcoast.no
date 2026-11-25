import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MAINTENANCE_EMAIL, sendMail } from '@/lib/mail';
import { maintenanceInternal, maintenanceReceipt } from '@/lib/mail/templates';
import { PORTAL_URL } from '@/lib/site';

export const MAINTENANCE_BUCKET = 'maintenance-photos';

/** Svaret fra finish_maintenance_report(). */
type Finished = {
  ok?: boolean;
  already?: boolean;
  photos?: number;
  serial?: string | null;
  vessel?: string | null;
  imo?: string | null;
  reporter?: string | null;
  reporter_email?: string | null;
  notes?: string | null;
  matched?: boolean;
  /** 'link' for registreringer via lenke, 'web' for det gamle åpne skjemaet. */
  source?: string;
};

export type FinishResult = { ok: boolean; photos: number; receipt: string | null };

/**
 * Avslutter en registrering uten innlogging (via lenke, eller det gamle åpne
 * skjemaet), og sender e-post.
 *
 * finish_maintenance_report() knytter bildene som faktisk ligger i lagringen
 * til registreringen og stempler den som avsluttet. Den er idempotent: kalles
 * den to ganger (dobbeltklikk, nytt forsøk etter dårlig dekning), svarer den
 * `already`, og e-posten sendes ikke på nytt.
 *
 * Registreringer via lenke varsles i portalen til dem som forvalter leideren
 * (maintenance_logs_notify), og går ikke på e-post til NorthWestCoast. Den
 * som registrerte, får en kvittering hvis e-postadressen er oppgitt.
 *
 * Klienten er besøkerens egen (anonyme) sesjon. Id-en er en tilfeldig UUID
 * som bare den som nettopp sendte inn kjenner, og funksjonen tar bare imot
 * registreringer fra de siste to timene.
 *
 * E-posten er et tillegg: feiler den, er registreringen likevel lagret.
 */
export async function finishMaintenance(
  supabase: SupabaseClient<Database>,
  logId: string,
  paths: string[],
  lang: 'no' | 'en' = 'no',
): Promise<FinishResult> {
  const { data, error } = await supabase.rpc('finish_maintenance_report', {
    p_log: logId,
    p_paths: paths,
  });

  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    // P0001 er «Fant ikke rapporten» (ukjent id eller for gammel).
    if (error && error.code !== 'P0001') {
      console.error('[maintenance] Kunne ikke avslutte rapporten:', error.code, error.message);
    }
    return { ok: false, photos: 0, receipt: null };
  }

  const report = data as Finished;
  const photos = typeof report.photos === 'number' ? report.photos : 0;
  if (report.already) return { ok: true, photos, receipt: null };
  const viaLink = report.source === 'link';
  let receipt: string | null = null;

  try {
    const name = report.reporter ?? 'Ukjent';
    const boat = report.vessel ?? '–';
    const serial = report.serial ?? '–';
    const fields = {
      name,
      boat,
      imo: report.imo ?? undefined,
      serial,
      email: report.reporter_email ?? undefined,
      notes: report.notes ?? undefined,
      photoCount: photos,
    };

    // Bildene ligger i en privat bøtte og vises i admin; e-posten lenker dit
    // i stedet for til selve filene.
    if (!viaLink) await sendMail(
      {
        to: MAINTENANCE_EMAIL,
        replyTo: report.reporter_email ?? undefined,
        ...maintenanceInternal({
          ...fields,
          matchedLadder: report.matched === true,
          adminUrl: `${PORTAL_URL}/admin/vedlikehold`,
        }),
      },
      { template: 'maintenance_internal', relatedType: 'maintenance_log', relatedId: logId },
    );

    if (report.reporter_email) {
      // Kvitteringen til fartøyet er dokumentasjon ved tilsyn, så den skal
      // inneholde selve rapporten. Den skrives på kundens språk; den interne
      // rapporten er alltid norsk.
      await sendMail(
        { to: report.reporter_email, replyTo: MAINTENANCE_EMAIL, ...maintenanceReceipt({ ...fields, lang }) },
        { template: 'maintenance_receipt', relatedType: 'maintenance_log', relatedId: logId },
      );
      receipt = report.reporter_email;
    }
  } catch (mailError) {
    console.error('[maintenance] E-post feilet for rapport', logId, mailError);
  }

  return { ok: true, photos, receipt };
}
