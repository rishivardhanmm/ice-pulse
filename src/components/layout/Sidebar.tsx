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
        className="ice-nav-item mb-0.5 flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-[13px] opacity-40"
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
      className={`ice-nav-item mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] ${
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

  const user = session?.user;
  const isInternal = user?.role === 'admin' || user?.role === 'internal';
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <aside
      className={`ice-scroll fixed left-0 top-0 z-50 flex h-screen w-[264px] flex-col overflow-y-auto transition-transform duration-200 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-6 pb-5 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ice-logo-white.svg" alt="ICE" className="block h-6 w-auto self-center" />
        <span className="font-display text-[18px] font-extrabold leading-none text-white">
          Pulse
        </span>
        <span
          className="ml-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
          style={{ background: 'var(--gold)', color: '#14082a' }}
        >
          BETA
        </span>
      </div>

      <nav className="flex-1 px-3.5 pb-4">
        {/* Show full nav for internal/admin, or just clients link for client role */}
        {isInternal ? (
          <>
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="mb-2">
                <p
                  className="px-3 pb-1.5 pt-4 text-[9.5px] font-semibold uppercase tracking-[1.6px]"
                  style={{ color: 'rgba(255,255,255,0.32)' }}
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
              <div key={section.label} className="mb-2">
                <p
                  className="px-3 pb-1.5 pt-4 text-[9.5px] font-semibold uppercase tracking-[1.6px]"
                  style={{ color: 'rgba(255,255,255,0.32)' }}
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
          <div className="mb-2">
            <p
              className="px-3 pb-1.5 pt-4 text-[9.5px] font-semibold uppercase tracking-[1.6px]"
              style={{ color: 'rgba(255,255,255,0.32)' }}
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
        className="mx-3.5 mb-4 rounded-2xl p-3"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
            style={{ background: 'linear-gradient(135deg, var(--gold), var(--orange))', color: '#14082a' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white">
              {user?.name ?? 'Loading…'}
            </p>
            <p className="truncate text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {user?.role === 'client' ? user.clientName ?? 'Client' : 'ICE Creates'}
            </p>
          </div>
          <button
            onClick={() => void signOut({ callbackUrl: '/login' })}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)' }}
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
