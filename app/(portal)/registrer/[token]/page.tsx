import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { Card, KV } from '@/components/portal/ui';
import MaintenanceChecklistForm from '@/components/maintenance-checklist-form';
import ChecklistPrint, { PrintSheetButton } from '@/components/checklist-print';
import { LINK_TOKEN, linkPath } from '@/components/minside/maintenance-links';
import { CHECKLISTS, printSheets, sheetLabels } from '@/lib/maintenance-checklists';
import { getDict, localePath, type Lang } from '@/lib/i18n';
import { siteHref } from '@/lib/site';
import { idag } from '@/lib/format';
import { finishViaLink, submitViaLink } from './actions';

export const metadata: Metadata = {
  title: 'Registrer vedlikehold',
  robots: { index: false, follow: false },
};

// Lenken kan trekkes tilbake når som helst: aldri fra cache.
export const dynamic = 'force-dynamic';

type LinkInfo = {
  state: 'active' | 'revoked' | 'expired';
  serial?: string;
  product?: string;
  length_m?: number | null;
  vessel?: string | null;
  recipient?: string | null;
  created_by_name?: string | null;
  expires_at?: string;
};

function parseLink(data: unknown): LinkInfo | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const state = (data as { state?: unknown }).state;
  return state === 'active' || state === 'revoked' || state === 'expired' ? (data as LinkInfo) : null;
}

const dateIn = (lang: Lang, iso: string) =>
  new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Oslo',
  });

/** Dato ett år tilbake (ÅÅÅÅ-MM-DD), samme grense som databasen bruker. */
function yearAgo(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 366);
  return date.toISOString().slice(0, 10);
}

function Shell({ lang, token, children }: { lang: Lang; token: string; children: React.ReactNode }) {
  const t = getDict(lang).maintenanceForm.link;
  const other: Lang = lang === 'no' ? 'en' : 'no';
  return (
    <div className="pt">
      <div className="pt-public">
        <div className="pt-public-brand">
          <div>
            <strong>NorthWestCoast</strong>
            <div className="pt-hint">{t.brand}</div>
          </div>
          {LINK_TOKEN.test(token) && (
            <Link href={`${linkPath(token)}${other === 'en' ? '?lang=en' : ''}`} className="pt-link" hrefLang={other}>
              {t.switchLang}
            </Link>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function Message({ lang, token, title, children }: { lang: Lang; token: string; title: string; children: React.ReactNode }) {
  return (
    <Shell lang={lang} token={token}>
      <div className="pt-card">
        <div className="pt-empty">
          <strong>{title}</strong>
          {children}
        </div>
      </div>
    </Shell>
  );
}

/**
 * Registrering av vedlikehold via lenke, uten innlogging. Tokenet i adressen
 * er nøkkelen; databasen slår det opp via hashen og bestemmer leideren.
 */
export default async function RegistrerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const lang: Lang = query.lang === 'en' ? 'en' : 'no';
  const f = getDict(lang).maintenanceForm;
  const t = f.link;

  if (!LINK_TOKEN.test(token)) {
    return <Message lang={lang} token={token} title={t.invalidTitle}>{t.invalidBody}</Message>;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('get_maintenance_link', { p_token: token });
  if (error) console.error('[registrer] get_maintenance_link feilet:', error.message);

  const link = parseLink(data);
  if (!link) return <Message lang={lang} token={token} title={t.notFoundTitle}>{t.notFoundBody}</Message>;
  if (link.state === 'revoked') return <Message lang={lang} token={token} title={t.revokedTitle}>{t.revokedBody}</Message>;
  if (link.state === 'expired') return <Message lang={lang} token={token} title={t.expiredTitle}>{t.expiredBody}</Message>;

  const today = idag();
  const product = [link.product, link.length_m ? `${String(link.length_m).replace('.', lang === 'no' ? ',' : '.')} m` : null]
    .filter(Boolean)
    .join(', ');

  return (
    <Shell lang={lang} token={token}>
      <div className="pt-header">
        <div>
          <div className="pt-header-title">
            <h1>{t.title}</h1>
          </div>
          <p>{[link.vessel, link.serial].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <Card>
        <KV
          items={[
            { label: t.ladder, value: link.serial },
            { label: t.vessel, value: link.vessel },
            { label: t.product, value: product || null },
            { label: t.validUntil, value: link.expires_at ? dateIn(lang, link.expires_at) : null },
          ]}
        />
        {link.created_by_name && <p className="pt-hint" style={{ marginTop: '0.75rem' }}>{t.createdBy(link.created_by_name)}</p>}
      </Card>

      <Card>
        <MaintenanceChecklistForm
          lang={lang}
          today={today}
          minDate={yearAgo(today)}
          askName
          submit={submitViaLink.bind(null, token, lang)}
          finish={finishViaLink.bind(null, lang)}
        />
      </Card>

      <Card title={f.printTitle} description={f.printSub}>
        <div className="mf-print-buttons">
          {CHECKLISTS.map((kind) => (
            <PrintSheetButton key={kind} kind={kind} label={f.kinds[kind]} className="pt-btn pt-btn-ghost" />
          ))}
        </div>
        <p className="pt-hint" style={{ marginTop: '0.9rem' }}>
          <a href={siteHref(`${localePath(lang, '/veiledning')}#sjekklister`)} className="pt-link">{t.guide}</a>
        </p>
        <ChecklistPrint
          sheets={printSheets(lang)}
          labels={sheetLabels(lang)}
          prefill={{ vessel: link.vessel, serial: link.serial }}
        />
      </Card>
    </Shell>
  );
}
