import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMedia } from '@/lib/portal/context';
import { uuid } from '@/lib/portal/forms';
import { Badge, Card, KV, PageHeader } from '@/components/portal/ui';
import { ActionButton } from '@/components/portal/forms';
import PostBody from '@/components/post-body';
import Lightbox from '@/components/lightbox';
import { canOptimizeImage, DEFAULT_ARTICLE_IMAGE } from '@/lib/articles';
import { dato, datoTid } from '@/lib/format';
import { resolveImage } from '@/lib/post-markdown';
import { actionLabel, changedFields, listFields, revisionPost, type RevisionPost } from '@/lib/post-revisions';
import { restorePostRevision } from '../../../actions';

/** Versjonen slik den så ut på nettsiden, på ett språk. */
function VersionPreview({ version, lang }: { version: RevisionPost; lang: 'no' | 'en' }) {
  const english = lang === 'en';
  const cover = resolveImage(version.cover_image_url) ?? DEFAULT_ARTICLE_IMAGE;
  const title = (english && version.title_en) || version.title_no;
  const tag = (english && version.tag_en) || version.tag_no;
  const body = (english && version.body_en?.trim()) || version.body_no;

  return (
    <div className="pt-post-preview-page">
      <div className="article-hero">
        <div className="article-hero-img">
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 1100px) 100vw, 1000px"
            style={{ objectFit: 'cover' }}
            unoptimized={!canOptimizeImage(cover)}
          />
          <div className="article-hero-overlay" />
        </div>
        <div className="article-hero-content">
          <span className="news-tag">{tag}</span>
          <h1>{title}</h1>
          <p className="article-meta">{version.published_at ? dato(version.published_at) : 'Ikke publisert'}</p>
        </div>
      </div>
      <section className="article-section">
        <article className="article-body">
          <PostBody body={body} lang={lang} />
        </article>
      </section>
    </div>
  );
}

/** Én versjon av et innlegg: innholdet, hva som ble endret, og knappen som henter den tilbake. */
export default async function VersjonPage({ params }: { params: Promise<{ id: string; rev: string }> }) {
  const { id: rawId, rev: rawRev } = await params;
  const id = uuid(rawId);
  const rev = uuid(rawRev);
  if (!id || !rev) notFound();

  const { supabase } = await requireMedia(`/admin/nyheter/${id}/versjon/${rev}`);

  const { data: revision } = await supabase
    .from('post_revisions')
    .select('id, post_id, action, data, changed_by_name, changed_at')
    .eq('id', rev)
    .eq('post_id', id)
    .maybeSingle();
  if (!revision) notFound();

  const [{ data: previous }, { data: newest }, { data: post }] = await Promise.all([
    supabase
      .from('post_revisions')
      .select('data')
      .eq('post_id', id)
      .lt('changed_at', revision.changed_at)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('post_revisions')
      .select('id')
      .eq('post_id', id)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('posts').select('id, status, title_no').eq('id', id).maybeSingle(),
  ]);

  const version = revisionPost(revision.data);
  const changes = changedFields(version, previous ? revisionPost(previous.data) : null);
  const current = newest?.id === revision.id && Boolean(post);
  const back = post ? `/admin/nyheter/${id}` : '/admin/nyheter';
  const when = datoTid(revision.changed_at);

  return (
    <>
      <PageHeader
        title={`Versjon fra ${when}`}
        crumbs={[
          { href: '/admin/nyheter', label: 'Nyheter' },
          ...(post ? [{ href: back, label: post.title_no }] : []),
          { label: when },
        ]}
        badge={current ? <Badge tone="info">Gjeldende</Badge> : undefined}
        description={post ? undefined : 'Innlegget er slettet. Henter du det tilbake, kommer det som kladd.'}
      />

      <Card>
        <KV
          items={[
            { label: 'Hva', value: actionLabel(revision.action) },
            { label: 'Av', value: revision.changed_by_name ?? '–' },
            { label: 'Endret', value: changes.length ? listFields(changes) : '–' },
            { label: 'Status', value: version.status === 'published' ? 'Publisert' : 'Kladd' },
            { label: 'Adresse', value: <span className="pt-mono">{version.slug}</span> },
          ]}
        />
        <div className="pt-actions" style={{ marginTop: '1rem' }}>
          {!current && (
            <ActionButton
              action={restorePostRevision}
              fields={{ revision_id: revision.id }}
              label={post ? 'Hent tilbake denne versjonen' : 'Hent tilbake innlegget'}
              pendingLabel="Henter…"
              tone="primary"
              size="md"
              confirm={
                post
                  ? `Hente tilbake versjonen fra ${when}? Innholdet erstatter det som står nå${post.status === 'published' ? ', og vises på nettsiden med en gang' : ''}. Det som står nå, blir liggende som en versjon.`
                  : `Hente tilbake «${version.title_no}»? Det kommer tilbake som kladd.`
              }
            />
          )}
          <Link href={back} className="pt-btn pt-btn-ghost">Tilbake</Link>
        </div>
      </Card>

      {version.excerpt_no && (
        <Card title="Ingress">
          <p style={{ margin: 0 }}>{version.excerpt_no}</p>
          {version.excerpt_en && <p className="pt-muted" style={{ margin: '0.5rem 0 0' }}>{version.excerpt_en}</p>}
        </Card>
      )}

      <Card title="Norsk">
        <VersionPreview version={version} lang="no" />
      </Card>
      {(version.title_en || version.body_en?.trim()) && (
        <Card title="Engelsk">
          <VersionPreview version={version} lang="en" />
        </Card>
      )}
      <Lightbox />
    </>
  );
}
