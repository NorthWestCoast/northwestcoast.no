'use client';

import Link from 'next/link';
import { useLang, useT } from '@/components/lang-provider';
import { localePath } from '@/lib/i18n';

// Middleware skriver alle ukjente stier inn i [lang], så denne fanger 404-er
// på begge språk – og arver språket fra layouten over.
export default function NotFound() {
  const lang = useLang();
  const t = useT();

  return (
    <div className="nf">
      <div className="nf-code">{t.notFound.code}</div>
      <h1>{t.notFound.title}</h1>
      <p>{t.notFound.body}</p>
      <Link href={localePath(lang, '/')} className="btn-primary">
        {t.notFound.cta}
      </Link>
      <p className="nf-help">
        {t.notFound.help} <a href="tel:+4790407341">+47 904 07 341</a>
      </p>
    </div>
  );
}
