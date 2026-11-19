import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MAINTENANCE_EMAIL, sendMail } from '@/lib/mail';
import { maintenanceInternal, maintenanceReceipt } from '@/lib/mail/templates';
import { SITE_URL } from '@/lib/site';

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
};

export type FinishResult = { ok: boolean; photos: number };

/**
 * Avslutter en vedlikeholdsrapport fra det åpne skjemaet, og varsler.
 *
 * finish_maintenance_report() knytter bildene som faktisk ligger i lagringen
 * til rapporten, legger et varsel til administratorene i portalen og stempler
 * rapporten som avsluttet. Den er idempotent: kalles den to ganger
 * (dobbeltklikk, nytt forsøk etter dårlig dekning), svarer den `already`, og
 * e-posten sendes ikke på nytt.
 *
 * Klienten er besøkerens egen (anonyme) sesjon. Rapportens id er en tilfeldig
 * UUID som bare den som nettopp sendte inn kjenner, og funksjonen tar bare
 * imot rapporter fra skjemaet de siste to timene.
 *
 * E-posten er et tillegg: feiler den, er rapporten likevel lagret og varslet
 * i portalen.
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
    return { ok: false, photos: 0 };
  }

  const report = data as Finished;
  const photos = typeof report.photos === 'number' ? report.photos : 0;
  if (report.already) return { ok: true, photos };

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
    await sendMail(
      {
        to: MAINTENANCE_EMAIL,
        replyTo: report.reporter_email ?? undefined,
        ...maintenanceInternal({
          ...fields,
          matchedLadder: report.matched === true,
          adminUrl: `${SITE_URL}/admin/vedlikehold`,
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
    }
  } catch (mailError) {
    console.error('[maintenance] E-post feilet for rapport', logId, mailError);
  }

  return { ok: true, photos };
}
