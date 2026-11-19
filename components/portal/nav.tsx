'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Anchor, Bell, Boxes, Building2, ClipboardList, Factory, FileText, Inbox, KeyRound,
  LayoutDashboard, LifeBuoy, ListChecks, Menu, Newspaper, Package, Ship, ShoppingCart,
  Tags, Truck, UserCog, Users, Wrench, X,
} from 'lucide-react';

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

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
          NorthWest <span>Coast</span>
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
            NorthWest <span>Coast</span>
          </Link>
          <button type="button" className="pt-icon-btn pt-side-close" aria-label="Lukk meny" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="pt-side-area">{area}</div>

        <nav className="pt-nav" aria-label={area}>
          {groups.map((group, index) => (
            <div key={group.title ?? index} style={{ display: 'contents' }}>
              {group.title && <div className="pt-nav-group">{group.title}</div>}
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
          ))}
        </nav>

        <div className="pt-side-foot">{footer}</div>
      </aside>
    </>
  );
}
