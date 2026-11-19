import { notFound } from 'next/navigation';
import { requireMedia } from '@/lib/portal/context';
import { uuid } from '@/lib/portal/forms';
import { Alert, Badge, Card, PageHeader } from '@/components/portal/ui';
import { ActionButton, PortalForm } from '@/components/portal/forms';
import { Check, Hidden, Input, Select } from '@/components/admin/fields';
import GalleryThumb from '@/components/admin/gallery-thumb';
import { galleryImageSrc } from '@/lib/gallery';
import { datoTid } from '@/lib/format';
import { deleteImage, updateImage } from '../actions';
import { GALLERY_CATEGORIES } from '../categories';

/** Ett bilde i galleriet: tekster, kategori, rekkefølge og synlighet. */
export default async function GalleribildePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = uuid(rawId);
  if (!id) notFound();

  const { supabase } = await requireMedia(`/admin/galleri/${id}`);

  const { data: image } = await supabase
    .from('gallery_images')
    .select('id, image_url, storage_path, tag, alt_no, alt_en, caption_no, caption_en, contain, sort_order, published, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!image) notFound();

  const source = galleryImageSrc(image);

  return (
    <>
      <PageHeader
        title="Endre bilde"
        crumbs={[{ href: '/admin/galleri', label: 'Galleri' }, { label: 'Endre bilde' }]}
        badge={image.published ? <Badge tone="ok">Publisert</Badge> : <Badge>Skjult</Badge>}
        description={`Sist endret ${datoTid(image.updated_at)}.`}
      />

      {!source && (
        <Alert tone="danger" title="Bildet mangler">
          Fila finnes ikke lenger. Slett bildet og last det opp på nytt.
        </Alert>
      )}

      <Card>
        <div className="pt-form pt-gal-edit">
          {source && (
            <GalleryThumb
              src={source.src}
              alt={image.alt_no}
              contain={image.contain}
              unoptimized={source.unoptimized}
              large
            />
          )}

          <PortalForm action={updateImage} submitLabel="Lagre bildet" resetOnSuccess={false}>
            <Hidden fields={{ image_id: image.id }} />

            <div className="pt-form-row">
              <Input
                name="alt_no"
                label="Beskrivelse (norsk)"
                required
                minLength={2}
                maxLength={300}
                defaultValue={image.alt_no}
                hint="Skriv kort hva bildet viser. Beskrivelsen leses opp for dem som bruker skjermleser, og hjelper søkemotorer å forstå bildet."
              />
              <Input
                name="alt_en"
                label="Beskrivelse (engelsk)"
                maxLength={300}
                defaultValue={image.alt_en ?? ''}
                hint="Valgfri. Uten engelsk tekst vises den norske også på de engelske sidene."
              />
            </div>

            <div className="pt-form-row">
              <Input
                name="caption_no"
                label="Bildetekst (norsk)"
                maxLength={60}
                defaultValue={image.caption_no ?? ''}
                hint="Valgfri. Kort tekst som står nederst på selve bildet, inntil 60 tegn."
              />
              <Input
                name="caption_en"
                label="Bildetekst (engelsk)"
                maxLength={60}
                defaultValue={image.caption_en ?? ''}
              />
            </div>

            <div className="pt-form-row">
              <Select name="tag" label="Kategori" defaultValue={image.tag} hint="Fanen bildet vises under på gallerisiden.">
                {GALLERY_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </Select>
              <Input
                name="sort_order"
                label="Rekkefølge"
                type="number"
                min={0}
                max={9999}
                required
                inputMode="numeric"
                defaultValue={image.sort_order}
                hint="Lavest tall vises først. Like tall: det nyeste bildet først."
              />
            </div>

            <Check
              name="contain"
              label="Gjennomsiktig bakgrunn. Hele bildet vises, på sandfarget bunn, i stedet for å beskjæres."
              defaultChecked={image.contain}
            />
            <Check name="published" label="Vis bildet på nettsiden" defaultChecked={image.published} />
          </PortalForm>
        </div>
      </Card>

      <Card title="Slett bildet" description="Bildet fjernes fra nettsiden, og fila slettes. Det kan ikke hentes tilbake.">
        <ActionButton
          action={deleteImage}
          fields={{ image_id: image.id, back: 'true' }}
          label="Slett bildet"
          tone="danger"
          size="md"
          confirm={`Slette bildet «${image.alt_no}»? Dette kan ikke angres.`}
        />
      </Card>
    </>
  );
}
