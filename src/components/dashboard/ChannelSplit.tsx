'use client';

import { formatCompactNumber, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { MetricsTotals } from '@/lib/types';

function ChannelCard({
  label,
  icon,
  color,
  totals,
  currency,
  share,
}: {
  label: string;
  icon: string;
  color: string;
  totals: MetricsTotals;
  currency: string;
  share: number;
}) {
  const rows = [
    { label: 'Spend', value: formatCurrency(totals.spend, currency) },
    { label: 'Impressions', value: formatCompactNumber(totals.impressions) },
    { label: 'Clicks', value: formatNumber(totals.clicks) },
    { label: 'CTR', value: formatPercent(totals.ctr) },
    { label: 'Conversions', value: formatNumber(totals.conversions) },
    {
      label: 'Cost / conv.',
      value: totals.costPerConversion != null ? formatCurrency(totals.costPerConversion, currency) : '—',
    },
  ];

  return (
    <div className="ice-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]"
            style={{ background: `${color}1a`, color }}
          >
            <i className={`bi ${icon}`} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {label}
          </span>
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {Math.round(share)}% of spend
        </span>
      </div>

      {/* Spend share bar */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(share, 2)}%`, background: color }} />
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {r.label}
            </p>
            <p className="font-display text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
              {r.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChannelSplit({
  channels,
  currency,
}: {
  channels: { google: MetricsTotals; meta: MetricsTotals };
  currency: string;
}) {
  const totalSpend = channels.google.spend + channels.meta.spend;
  if (totalSpend <= 0) return null;

  return (
    <div>
      <h2 className="ice-section-title mb-3 text-base">Channel split</h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChannelCard
          label="Google Ads"
          icon="bi-google"
          color="#4285F4"
          totals={channels.google}
          currency={currency}
          share={(channels.google.spend / totalSpend) * 100}
        />
        <ChannelCard
          label="Meta Ads"
          icon="bi-meta"
          color="#1877F2"
          totals={channels.meta}
          currency={currency}
          share={(channels.meta.spend / totalSpend) * 100}
        />
      </div>
    </div>
  );
}
