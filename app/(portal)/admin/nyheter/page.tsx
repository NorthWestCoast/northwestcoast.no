import Link from 'next/link';
import { requireMedia } from '@/lib/portal/context';
import { Alert, Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { dato } from '@/lib/format';

export default async function NyheterPage({
  searchParams,
}: {
  searchParams: Promise<{ slettet?: string }>;
}) {
  const { slettet } = await searchParams;
  const { supabase } = await requireMedia();

  const { data: posts } = await supabase
    .from('posts')
    .select('id, slug, title_no, status, published_at, updated_at, author_name')
    .order('created_at', { ascending: false })
    .limit(200);

  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Nyheter"
        description="Innleggene som vises under Nyheter på nettsiden. Kladder er bare synlige her."
        actions={<Link href="/admin/nyheter/ny" className="pt-btn">Nytt innlegg</Link>}
      />

      {slettet && <Alert tone="ok" title="Innlegget er slettet" />}

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
    </>
  );
}
