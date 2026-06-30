'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routeMetaFor } from './nav';
import { ThemeToggle } from '../theme/ThemeToggle';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const meta = routeMetaFor(pathname);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center gap-3 border-b px-4 lg:left-[248px] lg:px-6"
      style={{
        background: 'var(--topbar-bg)',
        borderColor: 'var(--topbar-border)',
        boxShadow: '0 6px 20px rgba(20,8,42,0.04)',
      }}
    >
      <button onClick={onMenuClick} className="ice-icon-btn lg:hidden" aria-label="Open menu">
        <i className="bi bi-list text-xl" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-col">
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--topbar-muted)' }}
        >
          ICE Pulse · {meta.crumb}
        </span>
        <span
          className="truncate text-sm font-semibold leading-tight"
          style={{ color: 'var(--topbar-text)' }}
        >
          {meta.title}
        </span>
      </div>

      <div className="relative mx-auto hidden max-w-md flex-1 md:block">
        <i
          className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px]"
          style={{ color: 'var(--text-muted)' }}
          aria-hidden="true"
        />
        <input className="ice-search" placeholder="Search campaigns, metrics…" aria-label="Search" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <button className="ice-icon-btn relative" aria-label="Notifications">
          <i className="bi bi-bell" aria-hidden="true" />
          <span
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--red)' }}
          />
        </button>
        <div
          className="hidden items-center gap-2 rounded-full border px-2 py-1 sm:flex"
          style={{ background: 'var(--org-bg)', borderColor: 'var(--org-border)' }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md font-display text-[9px] font-extrabold"
            style={{ background: 'linear-gradient(135deg, var(--gold), var(--teal))', color: '#14082a' }}
          >
            IC
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--org-text)' }}>
            ICE Creates
          </span>
        </div>
        <Link href="/sync" className="ice-pill-btn-gold hidden sm:inline-flex">
          <i className="bi bi-arrow-repeat" aria-hidden="true" /> Sync
        </Link>
      </div>
    </header>
  );
}
