import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/supabase/staff';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, PageHeader } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import PostForm from '@/components/admin/post-form';
import { datoTid } from '@/lib/format';
import { deletePost, savePost } from '../actions';

export default async function InnleggPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lagret?: string }>;
}) {
  const { id: rawId } = await params;
  const { lagret } = await searchParams;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireStaff();

  const { data: post } = await supabase
    .from('posts')
    .select('id, slug, title_no, title_en, tag_no, tag_en, excerpt_no, excerpt_en, body_no, body_en, cover_image_url, status, published_at, updated_at, author_name')
    .eq('id', id)
    .maybeSingle();
  if (!post) notFound();

  const published = post.status === 'published';

  return (
    <>
      <PageHeader
        title={post.title_no}
        crumbs={[{ href: '/admin/nyheter', label: 'Nyheter' }, { label: post.title_no }]}
        badge={published ? <Badge tone="ok">Publisert</Badge> : <Badge>Kladd</Badge>}
        description={`Sist endret ${datoTid(post.updated_at)}${post.author_name ? ` · skrevet av ${post.author_name}` : ''}.`}
      />

      {lagret && <Alert tone="ok" title="Innlegget er opprettet" />}

      <Card>
        <PostForm action={savePost} post={post} />
      </Card>

      <Card title="Slett innlegget" description="Innlegget fjernes fra nettsiden og kan ikke hentes tilbake.">
        <ActionButton
          action={deletePost}
          fields={{ post_id: post.id }}
          label="Slett innlegget"
          tone="danger"
          size="md"
          confirm={`Slette «${post.title_no}»? Dette kan ikke angres.`}
        />
      </Card>
    </>
  );
}
