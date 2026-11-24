import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMedia } from '@/lib/portal/context';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import PostForm from '@/components/admin/post-form';
import { datoTid } from '@/lib/format';
import { actionLabel, changedFields, listFields, revisionPost } from '@/lib/post-revisions';
import { deletePost, restorePostRevision, savePost } from '../actions';

/** Så mange versjoner vises. De eldre ligger fortsatt i databasen. */
const REVISIONS_SHOWN = 30;

export default async function InnleggPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lagret?: string; hentet?: string }>;
}) {
  const { id: rawId } = await params;
  const { lagret, hentet } = await searchParams;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireMedia(`/admin/nyheter/${id}`);

  const [{ data: post }, { data: revisions }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, slug, title_no, title_en, tag_no, tag_en, excerpt_no, excerpt_en, body_no, body_en, cover_image_url, status, published_at, updated_at, author_name')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('post_revisions')
      .select('id, post_id, action, data, restored_from, changed_by_name, changed_at')
      .eq('post_id', id)
      .order('changed_at', { ascending: false })
      .limit(REVISIONS_SHOWN + 1),
  ]);
  if (!post) notFound();

  const published = post.status === 'published';
  const list = revisions ?? [];
  const contents = list.map((revision) => revisionPost(revision.data));

  return (
    <>
      <PageHeader
        title={post.title_no}
        crumbs={[{ href: '/admin/nyheter', label: 'Nyheter' }, { label: post.title_no }]}
        badge={published ? <Badge tone="ok">Publisert</Badge> : <Badge>Kladd</Badge>}
        description={`Sist endret ${datoTid(post.updated_at)}${post.author_name ? ` · skrevet av ${post.author_name}` : ''}.`}
      />

      {lagret && <Alert tone="ok" title="Innlegget er opprettet" />}
      {hentet && (
        <Alert tone="ok" title="Versjonen er hentet tilbake">
          Det som sto her før, ligger under Versjoner nederst.{' '}
          {published ? 'Innlegget er publisert, så endringen vises på nettsiden.' : 'Innlegget er en kladd og vises ikke på nettsiden før du publiserer det.'}
        </Alert>
      )}

      <Card>
        <PostForm action={savePost} post={post} />
      </Card>

      <Card
        title="Versjoner"
        description="Hver lagring blir en versjon. Du kan se en eldre versjon og hente den tilbake; det som står nå, blir da liggende som en versjon."
        flush
      >
        {list.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Lagret</th><th>Hva</th><th>Av</th><th /></tr>
            </thead>
            <tbody>
              {list.slice(0, REVISIONS_SHOWN).map((revision, index) => {
                const changes = changedFields(contents[index], contents[index + 1] ?? null);
                const current = index === 0;
                return (
                  <tr key={revision.id}>
                    <Td label="Lagret" className="pt-nowrap">
                      <Link href={`/admin/nyheter/${id}/versjon/${revision.id}`}>{datoTid(revision.changed_at)}</Link>
                    </Td>
                    <Td label="Hva">
                      <span>
                        {actionLabel(revision.action)}
                        {current && <> <Badge tone="info">Gjeldende</Badge></>}
                        {changes.length > 0 && (
                          <span className="pt-muted" style={{ display: 'block' }}>Endret {listFields(changes)}</span>
                        )}
                      </span>
                    </Td>
                    <Td label="Av">{revision.changed_by_name ?? '–'}</Td>
                    <Td>
                      <div className="pt-actions">
                        <Link href={`/admin/nyheter/${id}/versjon/${revision.id}`} className="pt-btn pt-btn-ghost pt-btn-sm">Vis</Link>
                        {!current && (
                          <ActionButton
                            action={restorePostRevision}
                            fields={{ revision_id: revision.id }}
                            label="Hent tilbake"
                            pendingLabel="Henter…"
                            confirm={`Hente tilbake versjonen fra ${datoTid(revision.changed_at)}? Innholdet erstatter det som står nå${published ? ', og vises på nettsiden med en gang' : ''}. Det som står nå, blir liggende som en versjon.`}
                          />
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="pt-hint" style={{ padding: '1rem 1.25rem' }}>Ingen versjoner ennå.</p>
        )}
      </Card>

      <Card
        title="Slett innlegget"
        description="Innlegget fjernes fra nettsiden. Det kan hentes tilbake under «Slettede innlegg» på nyhetslista."
      >
        <ActionButton
          action={deletePost}
          fields={{ post_id: post.id }}
          label="Slett innlegget"
          tone="danger"
          size="md"
          confirm={`Slette «${post.title_no}»? Det fjernes fra nettsiden, men kan hentes tilbake under «Slettede innlegg».`}
        />
      </Card>
    </>
  );
}
