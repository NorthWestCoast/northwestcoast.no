import JsonLd from '@/components/json-ld';
import { aboutLd, breadcrumbLd } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Mail, Phone } from 'lucide-react';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import { ORG } from '@/lib/site';
import type { Dict } from '@/lib/dictionaries/no';
import { DEFAULT_LANG, getDict, isLang, localePath, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'omOss', '/om-oss');
}

type Supplier = {
  key: keyof Dict['about']['production']['roles'];
  name: string;
  /** Bare nettsteder vi har kontrollert at tilhører leverandøren. */
  url?: string;
};

const SUPPLIERS: Supplier[] = [
  { key: 'plaMek', name: 'Pla-Mek', url: 'https://pla-mek.no' },
  { key: 'rempro', name: 'Rempro', url: 'https://www.rempro.no' },
  { key: 'mesterplast', name: 'Mesterplast', url: 'https://www.mesterplast.no' },
  { key: 'sula', name: 'Sula Bedriftstjeneste' },
  { key: 'haram', name: 'Haram Industrier' },
];

const FOUNDERS = [
  { name: 'Kristian Bjarne Dyb', initials: 'KD', email: 'kristian@astep.no', phone: false },
  { name: 'Arve Toven', initials: 'AT', email: 'arve@astep.no', phone: true },
  { name: 'Tor Arne Reitan', initials: 'TR', email: 'tor@astep.no', phone: false },
];

export default async function OmOssPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = getDict(lang);
  const a = t.about;

  return (
    <>
      <JsonLd data={[aboutLd(lang), breadcrumbLd(lang, [{ name: a.navLabel, path: '/om-oss' }])]} />

      <Nav />

      <div className="subpage-header subpage-header-wide">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{a.label}</div>
        <h1>{a.title}</h1>
        <p>{a.intro}</p>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      {/* Lokal produksjon */}
      <section className="product-intro" aria-labelledby="about-production">
        <div className="product-grid">
          <div>
            <div className="lbl lbl-dark">{a.production.label}</div>
            <h2 className="stitle dark" id="about-production">{a.production.title}</h2>
            <p className="sub dark">{a.production.sub}</p>
            <p className="lead-note">{a.production.chain}</p>
          </div>

          <div className="product-img">
            <Image
              src="/images/ladder-folded.png"
              alt={a.production.imageAlt}
              fill sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'contain', padding: '1.5rem' }}
              priority
            />
          </div>
        </div>

        <div className="supplier-block">
          <h3 className="supplier-heading">{a.production.suppliersLabel}</h3>
          <ul className="supplier-grid">
            {SUPPLIERS.map((s) => {
              const body = (
                <>
                  <span className="supplier-role">{a.production.roles[s.key]}</span>
                  <span className="supplier-name">
                    {s.name}
                    {s.url && <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />}
                  </span>
                </>
              );
              return (
                <li key={s.key}>
                  {s.url ? (
                    <a
                      className="supplier-card"
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={a.production.visit(s.name)}
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="supplier-card">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy-mid)" dual dualBottomFill="var(--navy-mid)" />

      {/* Gründerne */}
      <section className="founders" aria-labelledby="about-founders">
        <div className="section-inner">
          <div className="lbl">{a.founders.label}</div>
          <h2 className="stitle" id="about-founders">{a.founders.title}</h2>
          <p className="sub">{a.founders.sub}</p>

          <ul className="founder-grid">
            {FOUNDERS.map((f) => (
              <li className="founder-card" key={f.email}>
                <div className="founder-initials" aria-hidden="true">{f.initials}</div>
                <h3>{f.name}</h3>
                <p className="founder-role">{a.founders.role}</p>
                <div className="founder-contact">
                  <a
                    href={`mailto:${f.email}`}
                    className="plausible-event-name=Lead:+Email+click plausible-event-source=om-oss"
                  >
                    <Mail size={15} strokeWidth={1.6} aria-hidden="true" />
                    {f.email}
                  </a>
                  {f.phone && (
                    <a
                      href={`tel:${ORG.phone}`}
                      className="plausible-event-name=Lead:+Phone+click plausible-event-source=om-oss"
                    >
                      <Phone size={15} strokeWidth={1.6} aria-hidden="true" />
                      {ORG.phoneDisplay}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Wave top="var(--navy-mid)" bottom="var(--sand)" dual dualBottomFill="var(--sand)" />

      {/* Støttespillere */}
      <section className="supporters" aria-labelledby="about-supporters">
        <div className="supporters-grid">
          <div>
            <div className="lbl lbl-dark">{a.supporters.label}</div>
            <h2 className="stitle dark" id="about-supporters">{a.supporters.title}</h2>
            <p className="sub dark">{a.supporters.sub}</p>
          </div>
          <ul className="supporter-list">
            {a.supporters.names.map((name) => (
              <li className="supporter" key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </section>

      <Wave top="var(--sand)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      {/* Kontaktbånd – samme tekster som kontaktseksjonen på forsiden */}
      <section className="order-band">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{t.contact.label}</div>
        <h2>{t.contact.title}</h2>
        <p>{t.contact.sub}</p>
        <div className="band-actions">
          <Link href={`${localePath(lang, '/')}#kontakt`} className="btn-primary">
            {t.faq.contactCta}
          </Link>
          <a
            href={`tel:${ORG.phone}`}
            className="btn-ghost plausible-event-name=Lead:+Phone+click plausible-event-source=om-oss"
          >
            {t.product.call}
          </a>
        </div>
      </section>

      <Footer />
    </>
  );
}
