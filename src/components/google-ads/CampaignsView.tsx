'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { campaignsUrl } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { formatCompactNumber, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { CampaignDTO, CampaignListDTO, CampaignSortKey, MetricsTotals } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { DateRangePicker } from '@/components/controls/DateRangePicker';
import { CampaignTable } from './CampaignTable';
import { CampaignDetailDrawer } from './CampaignDetailDrawer';
import { CampaignCompare } from './CampaignCompare';

const SELECT_STYLE: React.CSSProperties = {
  background: 'var(--search-bg)',
  border: '1px solid var(--search-border)',
  color: 'var(--search-text)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 12,
  outline: 'none',
};

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

export function CampaignsView() {
  const sp = useSearchParams();
  const def = defaultRange(30);
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const from = isValidDateStr(fromParam) ? (fromParam as string) : def.from;
  const to = isValidDateStr(toParam) ? (toParam as string) : def.to;

  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<CampaignSortKey>('spend');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<CampaignDTO | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const url = campaignsUrl({
    from,
    to,
    sort,
    direction,
    status: status || undefined,
    channel: channel || undefined,
    search: search || undefined,
  });
  const { data, loading, error, refetch } = useFetch<CampaignListDTO>(url);

  const onSort = (key: CampaignSortKey) => {
    if (sort === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setDirection(key === 'name' ? 'asc' : 'desc');
    }
  };

  const hasFilters = Boolean(search || status || channel);
  const clearFilters = () => {
    setStatus('');
    setChannel('');
    setSearchInput('');
    setSearch('');
  };

  return (
    <>
      <PageHeader
        title="Google Ads Performance"
        subtitle="Filter, sort and drill into campaign performance from your latest sync."
      >
        {data && data.campaigns.length >= 2 && (
          <CampaignCompare campaigns={data.campaigns} from={from} to={to} />
        )}
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
        <select value={channel} onChange={(e) => setChannel(e.target.value)} style={SELECT_STYLE} aria-label="Filter by channel">
          <option value="">All channels</option>
          {data?.filters.channelTypes.map((c) => (
            <option key={c} value={c}>
              {c}
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
              <TableSkeleton rows={8} cols={6} />
            </div>
          )}
          {!error && !loading && data && data.campaigns.length > 0 && (
            <CampaignTable
              campaigns={data.campaigns}
              currency={data.currency}
              sort={sort}
              direction={direction}
              onSort={onSort}
              onSelect={setSelected}
            />
          )}
          {!error && !loading && data && data.campaigns.length === 0 && (
            <EmptyState
              icon={hasFilters ? 'bi-funnel' : 'bi-cloud-arrow-down'}
              title={hasFilters ? 'No campaigns match your filters' : 'No campaigns yet'}
              description={
                hasFilters
                  ? 'Try clearing the filters or widening the date range.'
                  : 'Run a Google Ads sync to pull campaigns into the dashboard.'
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

      <CampaignDetailDrawer campaign={selected} from={from} to={to} onClose={() => setSelected(null)} />
    </>
  );
}
