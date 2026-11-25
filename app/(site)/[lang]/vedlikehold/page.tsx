import type { Metadata } from 'next';
import Link from 'next/link';
import { Link2, LogIn, Printer, UserCog } from 'lucide-react';
import JsonLd from '@/components/json-ld';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import { breadcrumbLd } from '@/lib/seo';
import { portalHref } from '@/lib/site';
import { DEFAULT_LANG, getDict, isLang, localePath, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'vedlikehold', '/vedlikehold');
}

/**
 * Hvor vedlikehold registreres. Skjemaet selv finnes bare i Min side og på
 * lenker som den som forvalter leideren, lager (/registrer/…). Det åpne
 * skjemaet som sto her før, er stengt.
 */
export default async function VedlikeholdPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDict(l);
  const m = t.maintenance;
  // Min side finnes bare på norsk, derfor ingen språkprefiks.
  const login = portalHref('/logg-inn');

  return (
    <>
      <JsonLd data={[breadcrumbLd(l, [{ name: m.title, path: '/vedlikehold' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{m.label}</div>
        <h1>{m.title}</h1>
        <p>{m.sub}</p>
        <Link href={localePath(l, '/veiledning')} className="mnt-guide-link">
          {m.guideLink} →
        </Link>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      <section className="guide-light">
        <div className="section-inner">
          <div className="info-cards mnt-cards">
            <div className="info-card">
              <LogIn className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h2>{m.cards.login.title}</h2>
              <p>{m.cards.login.desc}</p>
              <Link href={login} className="news-link">{m.cards.login.cta}</Link>
            </div>
            <div className="info-card">
              <Link2 className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h2>{m.cards.link.title}</h2>
              <p>{m.cards.link.desc}</p>
            </div>
            <div className="info-card">
              <UserCog className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h2>{m.cards.owner.title}</h2>
              <p>{m.cards.owner.desc}</p>
              <Link href={login} className="news-link">{m.cards.owner.cta}</Link>
            </div>
            <div className="info-card">
              <Printer className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h2>{m.cards.paper.title}</h2>
              <p>{m.cards.paper.desc}</p>
              <Link href={`${localePath(l, '/veiledning')}#sjekklister`} className="news-link">{m.cards.paper.cta}</Link>
            </div>
          </div>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      <Footer />
    </>
  );
}
