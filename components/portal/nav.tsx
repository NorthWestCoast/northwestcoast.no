'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Anchor, Archive, BadgeCheck, BarChart3, Bell, Boxes, Building2, CalendarDays, ChevronDown, CircleHelp, ClipboardList, Factory, FileText, Images,
  Inbox, KeyRound, LayoutDashboard, Library, LifeBuoy, ListChecks, ListTree, MapPin, Menu, Newspaper, Package,
  PackagePlus, Ship, ShoppingCart, Tags, Truck, UserCog, Users, Warehouse, Wrench, X,
} from 'lucide-react';

/**
 * Samme logo som i toppmenyen på nettsiden. Bredde og høyde er filens eget
 * sideforhold (1569 × 385); størrelsen på skjermen settes i portal.css.
 */
function Logo() {
  return <Image src="/images/logo/NY-logo.png" alt="NorthWestCoast" width={163} height={40} priority />;
}

/**
 * Ikonene velges med navn. Serverkomponenter kan ikke sende selve
 * komponenten til en klientkomponent, bare tekst.
 */
const ICONS = {
  dashboard: LayoutDashboard,
  ladder: Anchor,
  vessel: Ship,
  orders: ShoppingCart,
  shop: Package,
  support: LifeBuoy,
  access: KeyRound,
  people: Users,
  bell: Bell,
  profile: UserCog,
  companies: Building2,
  production: Factory,
  service: Wrench,
  reports: ClipboardList,
  news: Newspaper,
  prices: Tags,
  deliveries: Truck,
  inbox: Inbox,
  steps: ListChecks,
  staff: UserCog,
  jobs: Boxes,
  doc: FileText,
  gallery: Images,
  library: Library,
  faq: CircleHelp,
  cabinet: Archive,
  project: MapPin,
  certificate: BadgeCheck,
  stock: Warehouse,
  purchase: PackagePlus,
  parts: ListTree,
  usage: BarChart3,
  calendar: CalendarDays,
} as const;

export type NavIcon = keyof typeof ICONS;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Tall i en grønn boble (uleste, ventende). */
  count?: number;
  /** Bare aktiv på nøyaktig denne stien (for oversiktssiden). */
  exact?: boolean;
};

export type NavGroup = { title?: string; items: NavItem[] };

export default function PortalNav({
  area,
  brandHref,
  groups,
  unread,
  notificationsHref,
  footer,
}: {
  area: string;
  brandHref: string;
  groups: NavGroup[];
  unread: number;
  notificationsHref: string;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Lukk skuffen når man har navigert.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Escape lukker skuffen, og siden bak skal ikke rulle mens den er åpen.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Den lengste stien som passer, vinner. Da lyser «Lager» på en vareside
  // under /admin/lager, men ikke sammen med «Innkjøp» under samme sti.
  const matches = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const current = groups
    .flatMap((group) => group.items)
    .filter(matches)
    .reduce<NavItem | null>((best, item) => (best && best.href.length >= item.href.length ? best : item), null);
  const isActive = (item: NavItem) => item.href === current?.href;

  // Gruppene kan legges sammen. Valget huskes i nettleseren (per område), og
  // gruppen med siden man står på, åpnes alltid.
  const storageKey = `nwc:nav-collapsed:${area}`;
  const activeGroup = groups.find((group) => group.title && group.items.some(isActive))?.title;
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      if (Array.isArray(stored)) {
        setCollapsed(stored.filter((title): title is string => typeof title === 'string' && title !== activeGroup));
      }
    } catch {
      // Uten lagring (privat vindu, blokkert) er alle gruppene åpne.
    }
    // Leses bare når menyen vises første gang; activeGroup følges opp under.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (activeGroup) setCollapsed((current) => (current.includes(activeGroup) ? current.filter((t) => t !== activeGroup) : current));
  }, [activeGroup]);

  function toggle(title: string) {
    setCollapsed((current) => {
      const next = current.includes(title) ? current.filter((t) => t !== title) : [...current, title];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Valget gjelder da bare til siden lastes på nytt.
      }
      return next;
    });
  }

  return (
    <>
      <header className="pt-topbar">
        <button
          type="button"
          className="pt-icon-btn"
          aria-label="Åpne meny"
          aria-expanded={open}
          aria-controls="pt-side"
          onClick={() => setOpen(true)}
        >
          <Menu size={20} />
        </button>
        <Link href={brandHref} className="pt-topbar-brand">
          <Logo />
        </Link>
        <Link href={notificationsHref} className="pt-icon-btn" aria-label={`Varsler (${unread} uleste)`}>
          <Bell size={18} />
          {unread > 0 && <span className="pt-dot">{unread > 99 ? '99+' : unread}</span>}
        </Link>
      </header>

      {open && <button type="button" className="pt-scrim" aria-label="Lukk meny" onClick={() => setOpen(false)} />}

      <aside id="pt-side" className="pt-side" data-open={open}>
        <div className="pt-side-head">
          <Link href={brandHref} className="pt-side-brand">
            <Logo />
          </Link>
          <button type="button" className="pt-icon-btn pt-side-close" aria-label="Lukk meny" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="pt-side-area">{area}</div>

        <nav className="pt-nav" aria-label={area}>
          {groups.map((group, index) => {
            const shut = Boolean(group.title && collapsed.includes(group.title));
            // Tellerne skal ikke forsvinne når gruppen er lagt sammen.
            const total = group.items.reduce((sum, item) => sum + (item.count ?? 0), 0);
            const id = `pt-nav-group-${index}`;
            return (
              <div key={group.title ?? index} className="pt-nav-section">
                {group.title && (
                  <button
                    type="button"
                    className="pt-nav-group"
                    aria-expanded={!shut}
                    aria-controls={id}
                    onClick={() => toggle(group.title!)}
                  >
                    <span>{group.title}</span>
                    {shut && total > 0 && <span className="pt-nav-count">{total > 99 ? '99+' : total}</span>}
                    <ChevronDown size={14} strokeWidth={2} className="pt-nav-chevron" aria-hidden="true" />
                  </button>
                )}
                <div id={id} className="pt-nav-items" hidden={shut}>
                  {group.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    return (
                      <Link key={item.href} href={item.href} aria-current={isActive(item) ? 'page' : undefined}>
                        <Icon size={17} strokeWidth={1.8} />
                        {item.label}
                        {item.count ? <span className="pt-nav-count">{item.count > 99 ? '99+' : item.count}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="pt-side-foot">{footer}</div>
      </aside>
    </>
  );
}
