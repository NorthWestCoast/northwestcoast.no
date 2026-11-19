import Link from 'next/link';
import type { Tone } from '@/lib/portal/labels';

/**
 * Byggeklossene i portalen. Rene serverkomponenter uten tilstand; alt
 * utseende ligger i app/(portal)/portal.css.
 */

type Crumb = { href?: string; label: string };

export function PageHeader({
  title,
  description,
  crumbs,
  badge,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  /** Vises ved siden av tittelen, f.eks. en status. */
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <>
      {crumbs && crumbs.length > 0 && (
        <nav className="pt-crumbs" aria-label="Brødsmulesti">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} style={{ display: 'contents' }}>
              {index > 0 && <span aria-hidden="true">/</span>}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="pt-header">
        <div>
          <div className="pt-header-title">
            <h1>{title}</h1>
            {badge}
          </div>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="pt-actions">{actions}</div>}
      </div>
    </>
  );
}

export function Card({
  title,
  description,
  actions,
  footer,
  flush = false,
  id,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Uten innvendig marg – for tabeller og lister som går kant i kant. */
  flush?: boolean;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="pt-card" id={id}>
      {(title || actions) && (
        <div className="pt-card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="pt-actions">{actions}</div>}
          {description && <p>{description}</p>}
        </div>
      )}
      {children !== undefined && children !== null && (
        <div className={flush ? 'pt-card-body pt-flush' : 'pt-card-body'}>{children}</div>
      )}
      {footer && <div className="pt-card-foot">{footer}</div>}
    </section>
  );
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="pt-stats">{children}</div>;
}

export function Stat({
  value,
  label,
  tone,
  href,
}: {
  value: React.ReactNode;
  label: string;
  tone?: Tone;
  href?: string;
}) {
  const content = (
    <>
      <div className="pt-stat-num">{value}</div>
      <div className="pt-stat-label">{label}</div>
    </>
  );
  return href
    ? <Link href={href} className="pt-stat" data-tone={tone}>{content}</Link>
    : <div className="pt-stat" data-tone={tone}>{content}</div>;
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className="pt-badge" data-tone={tone}>{children}</span>;
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Exclude<Tone, 'neutral'>;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="pt-alert" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="pt-empty">
      <strong>{title}</strong>
      {children}
      {action && <div><Link href={action.href} className="pt-btn pt-btn-sm">{action.label}</Link></div>}
    </div>
  );
}

/** Nøkkel/verdi-rutenett for spesifikasjoner. */
export function KV({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="pt-kv">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Tabellcelle med ledetekst. På mobil vises tabellen som kort, og da er
 * `label` teksten som står foran verdien.
 */
export function Td({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return <td data-label={label} className={className}>{children}</td>;
}

/** Faner øverst på en side. Hver fane er en egen URL. */
export function Tabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="pt-tabs">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.href === current ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="pt-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Skjema som ligger sammenslått til man trenger det («+ Legg til …»). */
export function Disclosure({
  summary,
  open,
  children,
}: {
  summary: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="pt-disclosure" open={open}>
      <summary>{summary}</summary>
      <div className="pt-disclosure-body">{children}</div>
    </details>
  );
}

export type TimelineItem = {
  key: string;
  date: string;
  title: React.ReactNode;
  text?: React.ReactNode;
  tone?: Tone;
  /** Planlagt, ikke utført ennå. */
  future?: boolean;
  extra?: React.ReactNode;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="pt-timeline">
      {items.map((item) => (
        <li key={item.key} data-tone={item.tone} data-future={item.future ? 'true' : undefined}>
          <div className="pt-timeline-date">{item.date}</div>
          <div className="pt-timeline-title">{item.title}</div>
          {item.text && <div className="pt-timeline-text">{item.text}</div>}
          {item.extra}
        </li>
      ))}
    </ol>
  );
}
