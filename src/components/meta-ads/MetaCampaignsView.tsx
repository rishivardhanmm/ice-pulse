'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@/lib/use-fetch';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { formatCompactNumber, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { MetaCampaignDTO, MetaCampaignListDTO, MetricsTotals } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { DateRangePicker } from '@/components/controls/DateRangePicker';
import { CampaignStatusPill } from '@/components/ui/StatusPill';

const SELECT_STYLE: React.CSSProperties = {
  background: 'var(--search-bg)',
  border: '1px solid var(--search-border)',
  color: 'var(--search-text)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 12,
  outline: 'none',
};

type SortKey = 'name' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'conversions' | 'costPerConversion';

const COLUMNS: Array<{ key: SortKey; label: string; align: 'left' | 'right' }> = [
  { key: 'name', label: 'Campaign', align: 'left' },
  { key: 'spend', label: 'Spend', align: 'right' },
  { key: 'impressions', label: 'Impressions', align: 'right' },
  { key: 'clicks', label: 'Clicks', align: 'right' },
  { key: 'ctr', label: 'CTR', align: 'right' },
  { key: 'conversions', label: 'Conv.', align: 'right' },
  { key: 'costPerConversion', label: 'Cost / Conv.', align: 'right' },
];

function MetricPills({ totals, currency }: { totals: MetricsTotals; currency: string }) {
  const pills = [
    { label: 'Spend', value: formatCurrency(totals.spend, currency) },
    { label: 'Impressions', value: formatCompactNumber(totals.impressions) },
    { label: 'Clicks', value: formatNumber(totals.clicks) },
    { label: 'CTR', value: formatPercent(totals.ctr) },
    { label: 'Conversions', value: formatNumber(totals.conversions) },
    {
      label: 'Cost / Conv.',
      value: totals.costPerConversion != null ? formatCurrency(totals.costPerConversion, currency) : '—',
    },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {pills.map((p) => (
        <div
          key={p.label}
          className="rounded-full px-4 py-2 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}
        >
          <span className="block font-display text-base font-extrabold" style={{ color: 'var(--section-heading)' }}>
            {p.value}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MetaCampaignsView() {
  const sp = useSearchParams();
  const def = defaultRange(30);
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const from = isValidDateStr(fromParam) ? (fromParam as string) : def.from;
  const to = isValidDateStr(toParam) ? (toParam as string) : def.to;

  const [status, setStatus] = useState('');
  const [objective, setObjective] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('spend');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = new URLSearchParams({ from, to });
  if (status) params.set('status', status);
  if (objective) params.set('objective', objective);
  if (search) params.set('search', search);

  const { data, loading, error, refetch } = useFetch<MetaCampaignListDTO>(
    `/api/meta-ads/campaigns?${params.toString()}`,
  );

  const sorted = useMemo(() => {
    if (!data) return [];
    const rows = [...data.campaigns];
    rows.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === 'string' && typeof bv === 'string') {
        return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av == null ? -Infinity : Number(av);
      const bn = bv == null ? -Infinity : Number(bv);
      return direction === 'asc' ? an - bn : bn - an;
    });
    return rows;
  }, [data, sort, direction]);

  const onSort = (key: SortKey) => {
    if (sort === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setDirection(key === 'name' ? 'asc' : 'desc');
    }
  };

  const hasFilters = Boolean(search || status || objective);
  const clearFilters = () => {
    setStatus('');
    setObjective('');
    setSearchInput('');
    setSearch('');
  };

  const money = (n: number | null) => (n != null ? formatCurrency(n, data?.currency ?? 'GBP') : '—');

  return (
    <>
      <PageHeader
        title="Meta Ads Performance"
        subtitle="Facebook & Instagram campaigns from your latest Meta sync."
      >
        <DateRangePicker />
      </PageHeader>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <i
            className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-[12px]"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search campaign name…"
            aria-label="Search campaign name"
            style={{ ...SELECT_STYLE, paddingLeft: 32, minWidth: 220 }}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={SELECT_STYLE} aria-label="Filter by status">
          <option value="">All statuses</option>
          {data?.filters.statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={objective} onChange={(e) => setObjective(e.target.value)} style={SELECT_STYLE} aria-label="Filter by objective">
          <option value="">All objectives</option>
          {data?.filters.objectives.map((o) => (
            <option key={o} value={o}>
              {o.replace(/^OUTCOME_/, '').replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="ice-pill-btn-ghost" type="button">
            <i className="bi bi-x-circle" aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      {data && data.campaigns.length > 0 && <MetricPills totals={data.totals} currency={data.currency} />}

      <Card padded={false}>
        <div className="p-3">
          {error && <ErrorState message={error} onRetry={refetch} />}
          {!error && loading && (
            <div className="p-2">
              <TableSkeleton rows={8} cols={7} />
            </div>
          )}
          {!error && !loading && data && sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="ice-table">
                <thead>
                  <tr>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        style={{ textAlign: col.align, cursor: 'pointer' }}
                        onClick={() => onSort(col.key)}
                      >
                        {col.label}
                        {sort === col.key && (
                          <i
                            className={`bi ${direction === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} ml-1 text-[8px]`}
                            aria-hidden="true"
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c: MetaCampaignDTO) => (
                    <tr key={c.id}>
                      <td className="ice-table-strong">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[320px] truncate" title={c.name}>
                            {c.name}
                          </span>
                          {c.status && <CampaignStatusPill status={c.status} />}
                        </div>
                        {c.objective && (
                          <span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {c.objective.replace(/^OUTCOME_/, '').replaceAll('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{money(c.spend)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(c.impressions)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(c.clicks)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPercent(c.ctr)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(c.conversions)}</td>
                      <td style={{ textAlign: 'right' }}>{money(c.costPerConversion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!error && !loading && data && sorted.length === 0 && (
            <EmptyState
              icon={hasFilters ? 'bi-funnel' : 'bi-meta'}
              title={hasFilters ? 'No campaigns match your filters' : 'No Meta campaigns yet'}
              description={
                hasFilters
                  ? 'Try clearing the filters or widening the date range.'
                  : 'Run a Meta Ads sync to pull campaigns from Facebook & Instagram.'
              }
              action={
                hasFilters ? (
                  <button onClick={clearFilters} className="ice-pill-btn-ghost" type="button">
                    Clear filters
                  </button>
                ) : (
                  <Link href="/sync" className="ice-pill-btn-gold">
                    <i className="bi bi-arrow-repeat" aria-hidden="true" /> Go to Sync Centre
                  </Link>
                )
              }
            />
          )}
        </div>
      </Card>
    </>
  );
}
