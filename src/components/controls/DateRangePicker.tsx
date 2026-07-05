'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ALL_TIME_START, RANGE_PRESETS, defaultRange, isValidDateStr, shiftDays, todayUtc } from '@/lib/date';

/**
 * Date-range control that stores the selection in the URL (?from=&to=) so the
 * page's data hook refetches and the range is shareable / bookmarkable.
 */
export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const def = defaultRange(30);
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const from = isValidDateStr(fromParam) ? (fromParam as string) : def.from;
  const to = isValidDateStr(toParam) ? (toParam as string) : def.to;

  const apply = useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(Array.from(sp.entries()));
      params.set('from', nextFrom);
      params.set('to', nextTo);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  const today = todayUtc();
  const activeDays =
    to === today
      ? (RANGE_PRESETS.find((p) => shiftDays(today, -(p.days - 1)) === from)?.days ?? null)
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex items-center gap-1 rounded-full p-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}
      >
        {RANGE_PRESETS.map((p) => {
          const isActive = activeDays === p.days;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => apply(shiftDays(today, -(p.days - 1)), today)}
              className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
              style={
                isActive
                  ? { background: 'var(--gold)', color: '#14082a', fontWeight: 700 }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {p.label.replace('Last ', '')}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => apply(ALL_TIME_START, today)}
          className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
          style={
            from <= ALL_TIME_START && to === today
              ? { background: 'var(--gold)', color: '#14082a', fontWeight: 700 }
              : { color: 'var(--text-secondary)' }
          }
        >
          All time
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <DateInput value={from} max={to} onChange={(v) => apply(v, to)} ariaLabel="From date" />
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <DateInput value={to} min={from} max={today} onChange={(v) => apply(from, v)} ariaLabel="To date" />
      </div>
    </div>
  );
}

function DateInput({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value);
      }}
      className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
      style={{
        background: 'var(--search-bg)',
        border: '1px solid var(--search-border)',
        color: 'var(--search-text)',
        colorScheme: 'light',
      }}
    />
  );
}
