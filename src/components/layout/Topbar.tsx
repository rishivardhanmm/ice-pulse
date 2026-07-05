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
      className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md lg:left-[264px] lg:px-7"
      style={{
        background: 'var(--topbar-bg)',
        borderColor: 'var(--topbar-border)',
      }}
    >
      <button onClick={onMenuClick} className="ice-icon-btn lg:hidden" aria-label="Open menu">
        <i className="bi bi-list text-xl" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <span
          className="hidden text-[11px] font-medium sm:inline"
          style={{ color: 'var(--topbar-muted)' }}
        >
          {meta.crumb}
        </span>
        <i
          className="bi bi-chevron-right hidden text-[9px] sm:inline"
          style={{ color: 'var(--topbar-muted)' }}
          aria-hidden="true"
        />
        <span
          className="truncate text-[13px] font-semibold leading-tight"
          style={{ color: 'var(--topbar-text)' }}
        >
          {meta.title}
        </span>
      </div>

      <div className="relative mx-auto hidden max-w-md flex-1 md:block">
        <i
          className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px]"
          style={{ color: 'var(--search-placeholder)' }}
          aria-hidden="true"
        />
        <input className="ice-search" placeholder="Search campaigns, metrics…" aria-label="Search" />
        <kbd
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            borderColor: 'var(--search-border)',
            color: 'var(--search-placeholder)',
            background: 'var(--surface)',
          }}
        >
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <button className="ice-icon-btn relative" aria-label="Notifications">
          <i className="bi bi-bell" aria-hidden="true" />
          <span
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--red)', boxShadow: '0 0 0 2px var(--card-bg)' }}
          />
        </button>
        <Link href="/sync" className="ice-pill-btn-gold hidden sm:inline-flex">
          <i className="bi bi-arrow-repeat" aria-hidden="true" /> Sync
        </Link>
      </div>
    </header>
  );
}
