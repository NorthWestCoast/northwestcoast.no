import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Hourglass, Mail, Phone, ShieldCheck, ShieldPlus } from 'lucide-react';
import JsonLd from '@/components/json-ld';
import Nav from '@/components/nav';
import Wave from '@/components/wave';
import Footer from '@/components/footer';
import ChecklistPrint, { PrintSheetButton } from '@/components/checklist-print';
import { breadcrumbLd } from '@/lib/seo';
import { ORG, portalHref } from '@/lib/site';
import { CONSTRUCTION_DRAWING, MAINTENANCE_PLAN as PLAN, MANUAL } from '@/lib/maintenance-plan';
import { printSheets, sheetLabels, type ChecklistKind } from '@/lib/maintenance-checklists';
import { DEFAULT_LANG, getDict, isLang, localePath, pageMetadata } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata(isLang(lang) ? lang : DEFAULT_LANG, 'veiledning', '/veiledning');
}

/**
 * Veiledning for bruk og vedlikehold, bygget på brukermanualen (rev. 7).
 *
 * Utskrift: siden skriver ut skjemaene (alle tre, eller det ene knappen
 * gjelder), ikke selve veiledningen. Hele veiledningen finnes som PDF.
 */
export default async function VeiledningPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const t = getDict(lang);
  const g = t.guide;

  const planRows = [
    { when: g.plan.before.when, what: g.plan.before.what, href: '#sjekklister' },
    { when: g.plan.after.when, what: g.plan.after.what, href: '#sjekklister' },
    { when: g.plan.quarterly.when(PLAN.inspectionMonths), what: g.plan.quarterly.what, href: '#sjekklister' },
    { when: g.plan.test.when(PLAN.testAfterMonths), what: g.plan.test.what },
  ];

  const lists: { kind: ChecklistKind; title: string; items: string[] }[] = [
    { kind: 'before_use', title: g.checklists.before.title, items: g.checklists.before.items(PLAN.testAfterMonths) },
    { kind: 'after_use', title: g.checklists.after.title, items: [...g.checklists.after.items] },
    {
      kind: 'quarterly',
      title: `${g.checklists.quarterly.title} · ${g.plan.quarterly.when(PLAN.inspectionMonths).toLowerCase()}`,
      items: [...g.checklists.quarterly.items(PLAN.testAfterMonths), g.checklists.quarterly.register],
    },
  ];

  const contactHref = `${localePath(lang, '/')}#kontakt`;

  return (
    <>
      <JsonLd data={[breadcrumbLd(lang, [{ name: g.title, path: '/veiledning' }])]} />

      <Nav />

      <div className="subpage-header">
        <div className="lbl lbl-center" style={{ marginBottom: '1rem' }}>{g.label}</div>
        <h1>{g.title}</h1>
        <p>{g.sub}</p>
        <div className="subpage-nav-links">
          <a href="#intervaller" className="subpage-nav-link">{g.anchors.plan}</a>
          <a href="#sjekklister" className="subpage-nav-link">{g.anchors.checklists}</a>
          <a href="#bruk" className="subpage-nav-link">{g.anchors.usage}</a>
          <a href="#oppbevaring" className="subpage-nav-link">{g.anchors.storage}</a>
          <a href="#reservedeler" className="subpage-nav-link">{g.anchors.parts}</a>
        </div>
      </div>

      <Wave top="var(--navy)" bottom="var(--sand-light)" dualBottomFill="var(--sand-light)" />

      {/* Intervaller, garanti og levetid */}
      <section className="guide-light anchor-section" id="intervaller" aria-labelledby="guide-plan">
        <div className="guide-split">
          <div className="guide-split-intro">
            <div className="lbl lbl-dark">{g.plan.label}</div>
            <h2 className="stitle dark" id="guide-plan">{g.plan.title}</h2>
            <p className="sub dark">{g.plan.sub}</p>
            <div className="cta-row">
              <Link href={localePath(lang, '/vedlikehold')} className="btn-primary">
                {g.plan.registerCta}
              </Link>
            </div>
          </div>

          <div className="data-table-box">
            <table className="data-table guide-plan-table">
              <caption className="sr-only">{g.plan.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{g.plan.when}</th>
                  <th scope="col">{g.plan.what}</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((row) => (
                  <tr key={row.when}>
                    <th scope="row">
                      {row.href ? <a href={row.href}>{row.when}</a> : row.when}
                    </th>
                    <td>{row.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="guide-warranty">
          <h3 className="guide-h3">{g.warranty.title}</h3>
          <div className="info-cards">
            <div className="info-card">
              <ShieldCheck className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h3>{g.warranty.standard.title(PLAN.warrantyYears)}</h3>
              <p>{g.warranty.standard.desc}</p>
            </div>
            <div className="info-card">
              <ShieldPlus className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h3>{g.warranty.extended.title(PLAN.extendedWarrantyYears)}</h3>
              <p>{g.warranty.extended.desc(PLAN.yearlyWarrantyAfterYears)}</p>
              {/* Min side finnes bare på norsk. */}
              <Link href={portalHref('/logg-inn')} className="news-link">{g.warranty.portalCta}</Link>
            </div>
            <div className="info-card">
              <Hourglass className="info-card-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
              <h3>{g.warranty.lifetime.title(PLAN.lifetimeYears)}</h3>
              <p>{g.warranty.lifetime.desc}</p>
            </div>
          </div>
          <p className="range-note">{g.warranty.note}</p>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy-mid)" dual dualBottomFill="var(--navy-mid)" />

      {/* Sjekklister */}
      <section className="guide-dark anchor-section" id="sjekklister" aria-labelledby="guide-checklists">
        <div className="section-inner">
          <div className="lbl">{g.checklists.label}</div>
          <h2 className="stitle" id="guide-checklists">{g.checklists.title}</h2>
          <p className="sub">{g.checklists.sub}</p>

          <div className="guide-lists">
            {lists.map((list) => (
              <div className="guide-list" key={list.kind}>
                <h3>{list.title}</h3>
                <ul>
                  {list.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <PrintSheetButton kind={list.kind} label={g.checklists.print} className="guide-list-print" />
              </div>
            ))}
          </div>

          <p className="guide-print-note">{g.checklists.printNote}</p>
        </div>
      </section>

      <Wave top="var(--navy-mid)" bottom="var(--sand-light)" dual dualBottomFill="var(--sand-light)" />

      {/* Bruk og rigging */}
      <section className="guide-light anchor-section" id="bruk" aria-labelledby="guide-usage">
        <div className="guide-media-grid">
          <div className="guide-photo">
            <Image
              src="/images/leider_in_use.jpg"
              alt={g.usage.imageAlt}
              fill
              sizes="(max-width: 960px) 100vw, 40vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div>
            <div className="lbl lbl-dark">{g.usage.label}</div>
            <h2 className="stitle dark" id="guide-usage">{g.usage.title}</h2>
            <ol className="guide-steps">
              {g.usage.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="range-note">{g.usage.note}</p>
          </div>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy-mid)" dual dualBottomFill="var(--navy-mid)" />

      {/* Oppbevaring */}
      <section className="certs anchor-section" id="oppbevaring" aria-labelledby="guide-storage">
        <div className="certs-grid guide-storage-grid">
          <div>
            <div className="lbl">{g.storage.label}</div>
            <h2 className="stitle" id="guide-storage">{g.storage.title}</h2>
            <ul className="guide-points">
              {g.storage.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="cta-row">
              <Link href={`${localePath(lang, '/produkter')}#oppbevaring`} className="btn-ghost">
                {g.storage.cabinetCta}
              </Link>
            </div>
          </div>
          <div className="cert-img">
            <Image
              src="/images/leider_folded.jpg"
              alt={g.storage.imageAlt}
              fill
              sizes="(max-width: 960px) 100vw, 40vw"
              style={{ objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      <Wave top="var(--navy-mid)" bottom="var(--sand-light)" dual dualBottomFill="var(--sand-light)" />

      {/* Reservedeler, utskifting og kassering */}
      <section className="guide-light anchor-section" id="reservedeler" aria-labelledby="guide-parts">
        <div className="section-inner">
          <div className="lbl lbl-dark">{g.parts.label}</div>
          <h2 className="stitle dark" id="guide-parts">{g.parts.title}</h2>
          <p className="sub dark">{g.parts.sub}</p>

          <div className="guide-parts">
            <figure className="guide-drawing">
              <Image
                src={CONSTRUCTION_DRAWING.src}
                alt={g.parts.drawingAlt}
                width={CONSTRUCTION_DRAWING.width}
                height={CONSTRUCTION_DRAWING.height}
                sizes="(max-width: 960px) 80vw, 360px"
              />
              <figcaption>
                <span className="sr-only">{g.parts.drawingCaption}</span>
                <ol className="guide-legend">
                  {g.parts.legend.map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </ol>
              </figcaption>
            </figure>

            <div className="guide-parts-side">
              <div className="info-card">
                <h3>{g.parts.listTitle}</h3>
                <ul className="check-list dark guide-check-single">
                  {g.parts.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="info-card">
                <h3>{g.parts.orderTitle}</h3>
                <p>{g.parts.orderBody}</p>
                <div className="guide-contact">
                  <a href={`tel:${ORG.phone}`} className="plausible-event-name=Lead:+Phone+click plausible-event-source=veiledning">
                    <Phone size={16} strokeWidth={1.8} aria-hidden="true" />
                    {ORG.phoneDisplay}
                  </a>
                  <a href={`mailto:${ORG.email}`}>
                    <Mail size={16} strokeWidth={1.8} aria-hidden="true" />
                    {ORG.email}
                  </a>
                </div>
                <p className="guide-portal-note">{g.parts.portal}</p>
                <Link href={portalHref('/logg-inn')} className="news-link">{g.parts.portalCta}</Link>
              </div>
            </div>
          </div>

          <div className="guide-retire">
            <h3 className="guide-h3">{g.retire.title}</h3>
            <p>{g.retire.replace}</p>
            <p>{g.retire.dispose}</p>
          </div>
        </div>
      </section>

      <Wave top="var(--sand-light)" bottom="var(--navy)" dual dualBottomFill="var(--navy)" />

      {/* Manualen og kontakt */}
      <section className="order-band">
        <h2>{g.help.title}</h2>
        <p>{g.help.sub}</p>
        <div className="band-actions">
          <a href={MANUAL.href} className="btn-primary plausible-event-name=Download:+Manual" download>
            <Download size={16} strokeWidth={1.8} aria-hidden="true" />
            {g.help.manual}
          </a>
          <a href={`tel:${ORG.phone}`} className="btn-ghost plausible-event-name=Lead:+Phone+click plausible-event-source=veiledning">
            {g.help.call}
          </a>
          <Link href={contactHref} className="btn-ghost">{t.products.help.cta}</Link>
        </div>
        <p className="guide-manual-meta">{g.help.manualMeta(MANUAL.revision, MANUAL.sizeMb)}</p>
      </section>

      <Footer />

      {/* Skjemaene. Vises bare på utskrift, og er det som skrives ut fra siden. */}
      <ChecklistPrint sheets={printSheets(lang)} labels={sheetLabels(lang)} printByDefault inline />
    </>
  );
}
