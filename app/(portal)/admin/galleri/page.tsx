import Link from 'next/link';
import { requireMedia } from '@/lib/portal/context';
import { Alert, Badge, Card, Empty, PageHeader, Td } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import GalleryThumb from '@/components/admin/gallery-thumb';
import GalleryUpload from '@/components/admin/gallery-upload';
import { galleryImageSrc } from '@/lib/gallery';
import { GALLERY_FOLDER, GALLERY_IMAGES } from '@/lib/gallery-images';
import { addImages, deleteImage, moveImage, setImagePublished } from './actions';
import { GALLERY_CATEGORIES, categoryName } from './categories';

/** Bildene som er lastet opp til galleriet på nettsiden. */
export default async function GalleriPage({
  searchParams,
}: {
  searchParams: Promise<{ slettet?: string }>;
}) {
  const { slettet } = await searchParams;
  const { supabase } = await requireMedia('/admin/galleri');

  // Samme sortering som galleriet på nettsiden (lib/gallery.ts).
  const { data: images, error } = await supabase
    .from('gallery_images')
    .select('id, image_url, storage_path, tag, alt_no, caption_no, contain, sort_order, published')
    .order('sort_order')
    .order('created_at', { ascending: false })
    .order('id')
    .limit(500);

  const count = images?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Galleri"
        description="Bildene du laster opp her vises på gallerisiden og i bildeseksjonen på forsiden."
      />

      {slettet && <Alert tone="ok" title="Bildet er slettet" />}
      {error && (
        <Alert tone="danger" title="Kunne ikke lese bildene">Last siden på nytt. Ingenting er endret.</Alert>
      )}

      <Alert tone="info" title="De faste bildene står ikke i lista">
        Galleriet har {GALLERY_IMAGES.length} faste bilder som alltid har ligget der. De ligger i koden til
        nettsiden, vises sammen med bildene dine og kan ikke endres eller slettes her.
      </Alert>

      <Card
        title="Last opp bilder"
        description="Bildene dine vises først i sin kategori, foran de faste. Forsiden viser de fire første i hver kategori."
      >
        <GalleryUpload
          action={addImages}
          folder={GALLERY_FOLDER}
          categories={GALLERY_CATEGORIES}
          defaultCategory="inUse"
        />
      </Card>

      <Card
        title={`Opplastede bilder (${count})`}
        description="Rekkefølgen her er rekkefølgen på nettsiden. Skjulte bilder vises bare her."
        flush
      >
        {images?.length ? (
          <table className="pt-table">
            <thead>
              <tr><th>Bilde</th><th>Beskrivelse</th><th>Kategori</th><th>Status</th><th>Rekkefølge</th><th /></tr>
            </thead>
            <tbody>
              {images.map((image, index) => {
                const source = galleryImageSrc(image);
                const edit = `/admin/galleri/${image.id}`;
                return (
                  <tr key={image.id}>
                    <Td>
                      {source ? (
                        <Link href={edit} aria-label={`Endre bildet «${image.alt_no}»`}>
                          <GalleryThumb
                            src={source.src}
                            alt={image.alt_no}
                            contain={image.contain}
                            unoptimized={source.unoptimized}
                          />
                        </Link>
                      ) : (
                        <Badge tone="danger">Bildet mangler</Badge>
                      )}
                    </Td>
                    <Td label="Beskrivelse" className="pt-table-strong">
                      <span>
                        <Link href={edit}>{image.alt_no}</Link>
                        {image.caption_no && (
                          <span className="pt-muted" style={{ display: 'block', fontWeight: 400 }}>
                            Bildetekst: {image.caption_no}
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td label="Kategori" className="pt-nowrap">{categoryName(image.tag)}</Td>
                    <Td label="Status">
                      {image.published ? <Badge tone="ok">Publisert</Badge> : <Badge>Skjult</Badge>}
                    </Td>
                    <Td label="Rekkefølge">
                      <div className="pt-actions">
                        {index > 0 && (
                          <ActionButton
                            action={moveImage}
                            fields={{ image_id: image.id, direction: 'up' }}
                            label="Flytt opp"
                          />
                        )}
                        {index < count - 1 && (
                          <ActionButton
                            action={moveImage}
                            fields={{ image_id: image.id, direction: 'down' }}
                            label="Flytt ned"
                          />
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="pt-actions">
                        <ActionButton
                          action={setImagePublished}
                          fields={{ image_id: image.id, published: image.published ? 'false' : 'true' }}
                          label={image.published ? 'Skjul' : 'Publiser'}
                        />
                        <Link href={edit} className="pt-btn pt-btn-ghost pt-btn-sm">Endre</Link>
                        <ActionButton
                          action={deleteImage}
                          fields={{ image_id: image.id }}
                          label="Slett"
                          tone="danger"
                          confirm={`Slette bildet «${image.alt_no}»? Det fjernes fra nettsiden og kan ikke hentes tilbake.`}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Ingen opplastede bilder ennå">
            Her legger du nye bilder til i galleriet på nettsiden, for eksempel fra en leveranse eller en
            montering. Velg bilder over for å laste opp det første.
          </Empty>
        )}
      </Card>
    </>
  );
}
