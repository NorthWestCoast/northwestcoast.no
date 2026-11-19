import type { ActionResult } from '@/lib/portal/forms';
import type { Tables } from '@/lib/supabase/database.types';
import { Hidden, Input, Select, Textarea } from './fields';
import KeepForm from './keep-form';
import MediaUpload from './media-upload';

type Post = Pick<
  Tables<'posts'>,
  | 'id' | 'slug' | 'title_no' | 'title_en' | 'tag_no' | 'tag_en' | 'excerpt_no' | 'excerpt_en'
  | 'body_no' | 'body_en' | 'cover_image_url' | 'status' | 'published_at'
>;

const FORMAT_HINT =
  'Blank linje gir nytt avsnitt. «## » først på linja gir overskrift, «- » gir punktliste. ' +
  '**fet** gir fet tekst, og [tekst](https://…) gir lenke.';

/** Skjemaet for et nyhetsinnlegg. Uten `post`: nytt innlegg. */
export default function PostForm({
  action,
  post,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  post?: Post;
}) {
  const publishedDate = post?.published_at
    ? new Date(post.published_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
    : '';

  return (
    <KeepForm action={action} submitLabel={post ? 'Lagre innlegget' : 'Opprett innlegget'}>
      {post && <Hidden fields={{ post_id: post.id }} />}

      <div className="pt-form-row">
        <Input name="title_no" label="Tittel (norsk)" required minLength={2} maxLength={200} defaultValue={post?.title_no ?? ''} />
        <Input name="title_en" label="Tittel (engelsk)" maxLength={200} defaultValue={post?.title_en ?? ''} />
      </div>

      <Input
        name="slug"
        label="Adresse (slug)"
        maxLength={120}
        defaultValue={post?.slug ?? ''}
        placeholder="lages av den norske tittelen"
        hint="Siste del av nettadressen. Tom: lages av den norske tittelen (små bokstaver, æ blir ae, ø blir o, å blir a, alt annet blir bindestrek)."
      />

      <div className="pt-form-row">
        <Input name="tag_no" label="Stikkord (norsk)" maxLength={40} defaultValue={post?.tag_no ?? 'Nyheter'} />
        <Input name="tag_en" label="Stikkord (engelsk)" maxLength={40} defaultValue={post?.tag_en ?? 'News'} />
      </div>

      <div className="pt-form-row">
        <Textarea name="excerpt_no" label="Ingress (norsk)" rows={3} maxLength={500} defaultValue={post?.excerpt_no ?? ''} />
        <Textarea name="excerpt_en" label="Ingress (engelsk)" rows={3} maxLength={500} defaultValue={post?.excerpt_en ?? ''} />
      </div>

      <Textarea
        name="body_no"
        label="Brødtekst (norsk)"
        rows={14}
        maxLength={40000}
        defaultValue={post?.body_no ?? ''}
        hint={FORMAT_HINT}
      />
      <Textarea
        name="body_en"
        label="Brødtekst (engelsk)"
        rows={10}
        maxLength={40000}
        defaultValue={post?.body_en ?? ''}
        hint="Samme formatering som i den norske teksten."
      />

      <MediaUpload name="cover_image_url" defaultValue={post?.cover_image_url ?? ''} folder="posts" />

      <div className="pt-form-row">
        <Select name="status" label="Status" defaultValue={post?.status ?? 'draft'}>
          <option value="draft">Kladd</option>
          <option value="published">Publisert</option>
        </Select>
        <Input
          name="published_date"
          label="Publiseringsdato"
          type="date"
          defaultValue={publishedDate}
          hint="Tom: settes til i dag første gang innlegget publiseres. En dato fram i tid skjuler innlegget til da."
        />
      </div>
    </KeepForm>
  );
}
