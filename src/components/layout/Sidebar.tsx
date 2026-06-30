'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { NAV_SECTIONS, ADMIN_NAV_SECTIONS, type NavItem } from './nav';

function isActiveRoute(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = !item.disabled && isActiveRoute(item.href, pathname);
  const inner = (
    <>
      <i className={`bi ${item.icon} w-[18px] text-center text-[15px]`} aria-hidden="true" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ background: 'var(--nav-badge-bg)', color: 'var(--nav-badge-text)' }}
        >
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.disabled) {
    return (
      <div
        className="ice-nav-item mb-0.5 flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] opacity-50"
        title="Coming in a later phase"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`ice-nav-item mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${
        active ? 'ice-nav-item-active' : ''
      }`}
    >
      {inner}
    </Link>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const logo = '/brand/ice-logo-indigo.svg';

  const user = session?.user;
  const isInternal = user?.role === 'admin' || user?.role === 'internal';
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <aside
      className={`ice-scroll fixed left-0 top-0 z-50 flex h-screen w-[248px] flex-col overflow-y-auto border-r transition-transform duration-200 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
        boxShadow: '1px 0 16px rgba(20,8,42,0.03)',
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-5 py-4"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="ICE" className="block h-6 w-auto self-center" />
        <span
          className="font-display text-[17px] font-extrabold leading-none"
          style={{ color: 'var(--text-primary)' }}
        >
          Pulse
        </span>
        <span
          className="ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
          style={{ background: 'var(--gold)', color: '#14082a' }}
        >
          BETA
        </span>
      </div>

      <nav className="flex-1 px-2.5 py-3">
        {/* Show full nav for internal/admin, or just clients link for client role */}
        {isInternal ? (
          <>
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="mb-1.5">
                <p
                  className="px-2 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[1.5px] opacity-70"
                  style={{ color: 'var(--sidebar-text)' }}
                >
                  {section.label}
                </p>
                {section.items.map((item) => (
                  <SidebarItem
                    key={`${item.label}-${item.href}`}
                    item={item}
                    pathname={pathname}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            ))}
            {ADMIN_NAV_SECTIONS.map((section) => (
              <div key={section.label} className="mb-1.5">
                <p
                  className="px-2 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[1.5px] opacity-70"
                  style={{ color: 'var(--sidebar-text)' }}
                >
                  {section.label}
                </p>
                {section.items.map((item) => (
                  <SidebarItem
                    key={`${item.label}-${item.href}`}
                    item={item}
                    pathname={pathname}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            ))}
          </>
        ) : (
          /* Client role: show only their dashboard link */
          <div className="mb-1.5">
            <p
              className="px-2 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[1.5px] opacity-70"
              style={{ color: 'var(--sidebar-text)' }}
            >
              My Dashboard
            </p>
            {user?.clientSlug && (
              <SidebarItem
                item={{ label: 'Performance', href: `/clients/${user.clientSlug}`, icon: 'bi-grid-1x2-fill' }}
                pathname={pathname}
                onNavigate={onClose}
              />
            )}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div
        className="border-t px-4 py-3.5"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
            style={{ background: 'linear-gradient(135deg, var(--gold), var(--cerise))', color: '#14082a' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold" style={{ color: 'var(--nav-hover-text)' }}>
              {user?.name ?? 'Loading…'}
            </p>
            <p className="truncate text-[10px]" style={{ color: 'var(--sidebar-text)' }}>
              {user?.role === 'client' ? user.clientName ?? 'Client' : 'ICE Creates'}
            </p>
          </div>
          <button
            onClick={() => void signOut({ callbackUrl: '/login' })}
            className="ice-icon-btn flex-shrink-0 text-xs"
            title="Sign out"
            aria-label="Sign out"
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
