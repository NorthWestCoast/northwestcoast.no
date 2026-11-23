'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Lightbox from '@/components/lightbox';
import PostBody from '@/components/post-body';
import { canOptimizeImage, DEFAULT_ARTICLE_IMAGE } from '@/lib/articles';
import type { Lang } from '@/lib/i18n';
import { galleryEntries, invalidImageRefs, resolveImage } from '@/lib/post-markdown';
import { fieldValue } from '@/lib/portal/upload-image';

type Snapshot = Record<
  'title_no' | 'title_en' | 'tag_no' | 'tag_en' | 'body_no' | 'body_en' | 'cover_image_url' | 'published_date',
  string
>;

const NAMES: (keyof Snapshot)[] = [
  'title_no', 'title_en', 'tag_no', 'tag_en', 'body_no', 'body_en', 'cover_image_url', 'published_date',
];

function read(form: HTMLFormElement | null | undefined): Snapshot {
  return Object.fromEntries(NAMES.map((name) => [name, fieldValue(form, name)])) as Snapshot;
}

/** «2026-08-30» → «30.08.2026», som på nettsiden. Tom dato: i dag. */
function displayDate(value: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

/** Det som bør rettes før publisering. Ingenting her stopper lagringen, bortsett fra bilder som mangler. */
function problems(s: Snapshot): string[] {
  const list: string[] = [];
  const bad = [...new Set([...invalidImageRefs(s.body_no), ...invalidImageRefs(s.body_en)])];
  if (bad.length) list.push(`Bilder som ikke er lastet opp: ${bad.map((ref) => `«${ref}»`).join(', ')}. Innlegget kan ikke lagres før de er fjernet eller lastet opp.`);

  const no = galleryEntries(s.body_no);
  const en = galleryEntries(s.body_en);
  const noCaption = no.filter((entry) => !entry.caption).length;
  const enCaption = en.filter((entry) => !entry.caption).length;
  if (noCaption) list.push(`${noCaption} ${noCaption === 1 ? 'bilde' : 'bilder'} i den norske teksten mangler bildetekst.`);
  if (enCaption) list.push(`${enCaption} ${enCaption === 1 ? 'bilde' : 'bilder'} i den engelske teksten mangler bildetekst.`);
  if (s.body_en.trim() && no.length !== en.length) {
    list.push(`Den norske teksten har ${no.length} bilder og den engelske ${en.length}. Engelske lesere ser bare bildene i den engelske teksten.`);
  }
  if (s.body_en.trim() && !s.title_en.trim()) list.push('Den engelske teksten har ingen engelsk tittel. Den norske tittelen vises da på engelsk.');
  if (s.cover_image_url && !resolveImage(s.cover_image_url)) list.push('Forsidebildet kan ikke vises. Last det opp her i stedet.');
  return list;
}

/**
 * Forhåndsvisning av innlegget med nettsidens eget oppsett (stilene i
 * globals.css er lastet i portalen også). Den følger skjemaet mens man
 * skriver, og viser hva som bør rettes før publisering.
 */
export default function PostPreview() {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('no');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!open) return;
    const form = root.current?.closest('form');
    if (!form) return;
    const update = () => setSnapshot(read(form));
    update();
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    return () => {
      form.removeEventListener('input', update);
      form.removeEventListener('change', update);
    };
  }, [open]);

  const s = snapshot;
  const english = lang === 'en';
  const pick = (no: string, en: string) => (english && en.trim() ? en.trim() : no.trim());
  const cover = (s && resolveImage(s.cover_image_url)) || DEFAULT_ARTICLE_IMAGE;
  const notes = s ? problems(s) : [];

  return (
    <div ref={root} className="pt-post-preview">
      <div className="pt-actions" style={{ alignItems: 'center' }}>
        <button type="button" className="pt-btn pt-btn-ghost" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? 'Skjul forhåndsvisningen' : 'Forhåndsvis innlegget'}
        </button>
        {open && (
          <div className="pt-post-preview-lang" role="group" aria-label="Språk i forhåndsvisningen">
            <button type="button" aria-pressed={!english} onClick={() => setLang('no')}>Norsk</button>
            <button type="button" aria-pressed={english} onClick={() => setLang('en')}>English</button>
          </div>
        )}
      </div>

      {open && s && (
        <>
          {notes.length > 0 && (
            <ul className="pt-post-preview-notes">
              {notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}

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
                <span className="news-tag">{pick(s.tag_no || 'Nyheter', s.tag_en || 'News')}</span>
                <h1>{pick(s.title_no, s.title_en) || 'Tittel mangler'}</h1>
                <p className="article-meta">{displayDate(s.published_date)}</p>
              </div>
            </div>

            <section className="article-section">
              <article className="article-body">
                <PostBody body={pick(s.body_no, s.body_en)} lang={lang} />
              </article>
            </section>
          </div>
          <Lightbox />
        </>
      )}
    </div>
  );
}
