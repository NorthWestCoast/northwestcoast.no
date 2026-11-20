import { requireMedia } from '@/lib/portal/context';
import { Card, PageHeader } from '@/components/portal/ui';
import PostForm from '@/components/admin/post-form';
import { savePost } from '../actions';

export default async function NyttInnleggPage() {
  await requireMedia('/admin/nyheter/ny');

  return (
    <>
      <PageHeader
        title="Nytt innlegg"
        crumbs={[{ href: '/admin/nyheter', label: 'Nyheter' }, { label: 'Nytt innlegg' }]}
        description="Innlegget lagres som kladd til du setter status til publisert."
      />
      <Card>
        <PostForm action={savePost} />
      </Card>
    </>
  );
}
