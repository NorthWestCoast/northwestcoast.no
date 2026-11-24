import Link from 'next/link';
import { requireMedia } from '@/lib/portal/context';
import { Alert, Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import { dato, datoTid } from '@/lib/format';
import { revisionPost } from '@/lib/post-revisions';
import { restorePostRevision } from './actions';

export default async function NyheterPage({
  searchParams,
}: {
  searchParams: Promise<{ slettet?: string }>;
}) {
  const { slettet } = await searchParams;
  const { supabase } = await requireMedia();

  const [{ data: posts }, { data: deletions }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, slug, title_no, status, published_at, updated_at, author_name')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('post_revisions')
      .select('id, post_id, data, changed_by_name, changed_at')
      .eq('action', 'deleted')
      .order('changed_at', { ascending: false })
      .limit(50),
  ]);

  // Slettede innlegg som ikke er hentet tilbake: siste sletting per innlegg.
  const deletedIds = [...new Set((deletions ?? []).map((row) => row.post_id))];
  const { data: back } = deletedIds.length
    ? await supabase.from('posts').select('id').in('id', deletedIds)
    : { data: [] as { id: string }[] };
  const returned = new Set((back ?? []).map((row) => row.id));
  const seen = new Set<string>();
  const deleted = (deletions ?? []).filter((row) => {
    if (returned.has(row.post_id) || seen.has(row.post_id)) return false;
    seen.add(row.post_id);
    return true;
  });

  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Nyheter"
        description="Innleggene som vises under Nyheter på nettsiden. Kladder er bare synlige her."
        actions={<Link href="/admin/nyheter/ny" className="pt-btn">Nytt innlegg</Link>}
      />

      {slettet && (
        <Alert tone="ok" title="Innlegget er slettet">
          Det kan hentes tilbake under «Slettede innlegg» nederst.
        </Alert>
      )}

      <Card flush>
        {posts?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Tittel</th><th>Status</th><th>Publisert</th><th>Adresse</th><th>Forfatter</th></tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const scheduled = post.status === 'published' && post.published_at !== null && new Date(post.published_at).getTime() > now;
                return (
                  <tr key={post.id}>
                    <Td label="Tittel" className="pt-table-strong">
                      <Link href={`/admin/nyheter/${post.id}`}>{post.title_no}</Link>
                    </Td>
                    <Td label="Status">
                      {post.status !== 'published'
                        ? <Badge>Kladd</Badge>
                        : scheduled
                          ? <Badge tone="warn">Planlagt</Badge>
                          : <Badge tone="ok">Publisert</Badge>}
                    </Td>
                    <Td label="Publisert" className="pt-nowrap">
                      {post.status === 'published' ? dato(post.published_at) : '–'}
                    </Td>
                    <Td label="Adresse"><span className="pt-mono">{post.slug}</span></Td>
                    <Td label="Forfatter">{post.author_name ?? '–'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen innlegg ennå" action={{ href: '/admin/nyheter/ny', label: 'Skriv det første innlegget' }} />
        )}
      </Card>

      {deleted.length > 0 && (
        <Card
          title="Slettede innlegg"
          description="Et slettet innlegg kan hentes tilbake. Det kommer tilbake som kladd, med alle versjonene sine."
          flush
        >
          <table className="pt-table">
            <thead>
              <tr><th>Tittel</th><th>Slettet</th><th>Av</th><th /></tr>
            </thead>
            <tbody>
              {deleted.map((row) => {
                const version = revisionPost(row.data);
                return (
                  <tr key={row.id}>
                    <Td label="Tittel" className="pt-table-strong">
                      <Link href={`/admin/nyheter/${row.post_id}/versjon/${row.id}`}>{version.title_no}</Link>
                    </Td>
                    <Td label="Slettet" className="pt-nowrap">{datoTid(row.changed_at)}</Td>
                    <Td label="Av">{row.changed_by_name ?? '–'}</Td>
                    <Td>
                      <ActionButton
                        action={restorePostRevision}
                        fields={{ revision_id: row.id }}
                        label="Hent tilbake"
                        pendingLabel="Henter…"
                        confirm={`Hente tilbake «${version.title_no}»? Det kommer tilbake som kladd.`}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
