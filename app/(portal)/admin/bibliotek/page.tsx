import { requireMedia } from '@/lib/portal/context';
import { Alert, PageHeader } from '@/components/portal/ui';
import MediaLibrary from '@/components/admin/media-library';
import { LIBRARY_COLUMNS, LIBRARY_LIMIT, usageByPath } from '@/lib/media-library';
import { deleteLibraryImage, updateLibraryImage } from './actions';

/** Felles bilder til nyhetene: last opp, beskriv og velg dem i nyhetsskjemaet. */
export default async function BibliotekPage() {
  const { supabase } = await requireMedia('/admin/bibliotek');

  const [images, posts] = await Promise.all([
    supabase
      .from('media_library')
      .select(LIBRARY_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(LIBRARY_LIMIT),
    supabase.from('posts').select('id, title_no, body_no, body_en, cover_image_url').limit(2000),
  ]);

  const rows = images.data ?? [];
  const usage = usageByPath(posts.data ?? [], rows.map((image) => image.storage_path));

  return (
    <>
      <PageHeader
        title="Bibliotek"
        description="Felles bilder til nyhetene. Last opp her, og velg dem i nyhetsskjemaet med «Legg til bilder» eller «Velg fra biblioteket»."
      />

      {(images.error || posts.error) && (
        <Alert tone="danger" title="Kunne ikke lese biblioteket">Last siden på nytt. Ingenting er endret.</Alert>
      )}

      <MediaLibrary
        images={rows.map((image) => ({ ...image, uses: usage.get(image.storage_path) ?? [] }))}
        updateAction={updateLibraryImage}
        deleteAction={deleteLibraryImage}
      />
    </>
  );
}
