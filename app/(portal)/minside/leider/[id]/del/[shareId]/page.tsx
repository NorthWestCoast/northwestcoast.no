import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/portal/context';
import { Alert, Badge, Card, Empty, KV, PageHeader } from '@/components/portal/ui';
import { ActionButton, CopyField } from '@/components/portal/forms';
import PhotoUploader from '@/components/portal/photo-uploader';
import { uuid } from '@/lib/portal/forms';
import { BUCKETS, signedUrls } from '@/lib/portal/storage';
import { datoTid } from '@/lib/format';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/site';
import { requestOrigin } from '@/lib/portal/landing';
import PhotoGrid from '@/components/minside/photo-grid';
import { shareStatus } from '@/components/minside/util';
import { attachSharePhotos, deleteSharePhoto, revokeShare } from './actions';

export const metadata: Metadata = { title: 'Delt tilstandsrapport' };

const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

type ChecklistItem = { label: string; checked: boolean };

/** Sjekklisten er lagret som JSON; les den uten å stole på formen. */
function readChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { label, checked } = item as { label?: unknown; checked?: unknown };
    return typeof label === 'string' ? [{ label, checked: checked === true }] : [];
  });
}

/**
 * Én delt tilstandsrapport: lenken (vises bare rett etter opprettelsen),
 * bilder, visninger og tilbaketrekking.
 */
export default async function DelingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; shareId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { id: rawId, shareId: rawShareId } = await params;
  const query = await searchParams;

  const id = uuid(rawId);
  const shareId = uuid(rawShareId);
  if (!id || !shareId) notFound();

  const { supabase } = await requireUser(`/minside/leider/${id}/del/${shareId}`);

  const [{ data: share }, { data: ladder }] = await Promise.all([
    supabase
      .from('ladder_state_shares')
      .select('id, ladder_id, title, recipient, note, checklist, created_at, created_by_name, expires_at, revoked_at, view_count, last_viewed_at, token_hash')
      .eq('id', shareId)
      .eq('ladder_id', id)
      .maybeSingle(),
    supabase.from('ladder_status').select('ladder_id, serial_number').eq('ladder_id', id).maybeSingle(),
  ]);
  if (!share || !ladder) notFound();

  const { data: photoRows } = await supabase
    .from('ladder_state_photos')
    .select('id, storage_path, captured_at')
    .eq('share_id', shareId)
    .order('captured_at');

  const urls = await signedUrls(supabase, BUCKETS.shares, (photoRows ?? []).map((p) => p.storage_path));
  const status = shareStatus(share);
  const checklist = readChecklist(share.checklist);

  // Lenken kan bare vises når tokenet følger med fra opprettelsen, og bare
  // hvis det faktisk hører til denne rapporten (hashen ligger i databasen).
  const rawToken = Array.isArray(query.token) ? query.token[0] : query.token;
  const token =
    rawToken && TOKEN.test(rawToken) && createHash('sha256').update(rawToken).digest('hex') === share.token_hash
      ? rawToken
      : null;

  const base = `/minside/leider/${id}`;
  const fields = { share_id: share.id, ladder_id: id };

  const photos = (photoRows ?? []).flatMap((photo) => {
    const url = urls.get(photo.storage_path);
    if (!url) return [];
    return [{
      key: photo.id,
      url,
      alt: `Bilde tatt ${datoTid(photo.captured_at)}`,
      caption: datoTid(photo.captured_at),
      below: (
        <div style={{ marginTop: '0.35rem' }}>
          <ActionButton
            action={deleteSharePhoto}
            fields={{ ...fields, photo_id: photo.id }}
            label="Slett"
            tone="danger"
            confirm="Slette bildet fra rapporten?"
          />
        </div>
      ),
    }];
  });

  return (
    <>
      <PageHeader
        title={share.title || 'Tilstandsrapport'}
        description={`Delt rapport for leider ${ladder.serial_number ?? ''}${share.recipient ? ` · til ${share.recipient}` : ''}`}
        crumbs={[
          { href: '/minside/leidere', label: 'Leidere' },
          { href: base, label: ladder.serial_number ?? 'Leider' },
          { href: `${base}?fane=deling`, label: 'Deling' },
          { label: share.title || 'Rapport' },
        ]}
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {token && status.active && (
        <Card title="Lenken til rapporten">
          <div className="pt-stack">
            <Alert tone="warn" title="Kopier lenken nå">
              Av sikkerhetsgrunner lagrer vi bare et fingeravtrykk av lenken, ikke lenken selv. Den vises
              derfor bare denne ene gangen. Mister du den, oppretter du en ny rapport.
            </Alert>
            <CopyField value={`${requestOrigin(await headers(), SITE_URL)}/los/${token}`} label="Kopier lenke" />
            <p className="pt-hint">
              Alle som har lenken kan se rapporten uten å logge inn, fram til den utløper eller du trekker den tilbake.
              Legg gjerne til bilder under før du sender den.
            </p>
          </div>
        </Card>
      )}

      {!token && status.active && (
        <Alert tone="info" title="Lenken vises bare når rapporten opprettes">
          Har du mistet lenken, trekker du denne rapporten tilbake og{' '}
          <Link href={`${base}?fane=deling#ny-rapport`}>oppretter en ny</Link>.
        </Alert>
      )}

      {!status.active && (
        <Alert tone="warn" title={share.revoked_at ? 'Lenken er trukket tilbake' : 'Lenken er utløpt'}>
          Rapporten kan ikke lenger åpnes av andre, og bildene er stengt for dem.
        </Alert>
      )}

      <Card title="Om rapporten">
        <div className="pt-stack">
          <KV
            items={[
              { label: 'Mottaker', value: share.recipient },
              { label: 'Opprettet', value: `${datoTid(share.created_at)}${share.created_by_name ? ` av ${share.created_by_name}` : ''}` },
              { label: share.revoked_at ? 'Trukket tilbake' : 'Utløper', value: datoTid(share.revoked_at ?? share.expires_at) },
              { label: 'Visninger', value: share.view_count },
              { label: 'Sist åpnet', value: share.last_viewed_at ? datoTid(share.last_viewed_at) : 'Ikke åpnet ennå' },
            ]}
          />
          {checklist.length > 0 && (
            <ul className="pt-list" style={{ margin: '0 -1.1rem' }}>
              {checklist.map((item) => (
                <li key={item.label}>
                  <div className="pt-list-main">{item.label}</div>
                  <div className="pt-list-side">
                    <Badge tone={item.checked ? 'ok' : 'neutral'}>{item.checked ? 'Bekreftet' : 'Ikke bekreftet'}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {share.note && <p style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{share.note}</p>}
        </div>
      </Card>

      <Card
        title="Bilder"
        description="Bildene vises i rapporten med tidspunktet de ble tatt. Ta dem rett før du deler, så viser de dagens tilstand."
      >
        <div className="pt-stack">
          {photos.length > 0 ? (
            <PhotoGrid photos={photos} large />
          ) : (
            <Empty title="Ingen bilder i rapporten ennå" />
          )}
          {!share.revoked_at && (
            <PhotoUploader
              bucket={BUCKETS.shares}
              folder={share.id}
              action={attachSharePhotos}
              fields={fields}
            />
          )}
        </div>
      </Card>

      {status.active && (
        <Card
          title="Trekk tilbake lenken"
          description="Lenken slutter å virke med en gang, og bildene stenges. Dette kan ikke angres."
        >
          <ActionButton
            action={revokeShare}
            fields={fields}
            label="Trekk tilbake lenken"
            tone="danger"
            size="md"
            confirm="Trekke tilbake lenken? Den som har fått den kan ikke lenger åpne rapporten."
          />
        </Card>
      )}
    </>
  );
}
