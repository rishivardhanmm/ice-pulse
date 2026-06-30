'use client';

import { CampaignStatusPill } from '@/components/ui/StatusPill';
import { formatCompactNumber, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { CampaignDTO, CampaignSortKey } from '@/lib/types';

const RIGHT = { textAlign: 'right' as const };

export function CampaignTable({
  campaigns,
  currency,
  sort,
  direction,
  onSort,
  onSelect,
}: {
  campaigns: CampaignDTO[];
  currency: string;
  sort: CampaignSortKey;
  direction: 'asc' | 'desc';
  onSort: (key: CampaignSortKey) => void;
  onSelect: (campaign: CampaignDTO) => void;
}) {
  const Th = ({
    sortKey,
    label,
    align,
  }: {
    sortKey?: CampaignSortKey;
    label: string;
    align?: 'right';
  }) => {
    const active = sortKey && sort === sortKey;
    return (
      <th
        style={align === 'right' ? RIGHT : undefined}
        onClick={sortKey ? () => onSort(sortKey) : undefined}
        className={sortKey ? 'cursor-pointer select-none' : undefined}
      >
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          {label}
          {active && (
            <i
              className={`bi ${direction === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} text-[9px]`}
              style={{ color: 'var(--gold)' }}
              aria-hidden="true"
            />
          )}
        </span>
      </th>
    );
  };

  return (
    <div className="ice-scroll overflow-x-auto">
      <table className="ice-table">
        <thead>
          <tr>
            <Th sortKey="name" label="Campaign" />
            <th>Status</th>
            <th>Channel</th>
            <Th sortKey="spend" label="Spend" align="right" />
            <Th sortKey="impressions" label="Impr." align="right" />
            <Th sortKey="clicks" label="Clicks" align="right" />
            <Th sortKey="ctr" label="CTR" align="right" />
            <Th sortKey="conversions" label="Conv." align="right" />
            <th style={RIGHT}>Cost/Conv.</th>
            <th aria-label="Open" style={{ width: 32 }} />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} onClick={() => onSelect(c)} className="cursor-pointer">
              <td className="ice-table-strong max-w-[260px] truncate" title={c.name}>
                {c.name}
              </td>
              <td>
                <CampaignStatusPill status={c.status} />
              </td>
              <td>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {c.channelType ?? '—'}
                </span>
              </td>
              <td style={RIGHT}>{formatCurrency(c.spend, currency)}</td>
              <td style={RIGHT}>{formatCompactNumber(c.impressions)}</td>
              <td style={RIGHT}>{formatNumber(c.clicks)}</td>
              <td style={RIGHT}>{formatPercent(c.ctr)}</td>
              <td style={RIGHT}>{formatNumber(c.conversions)}</td>
              <td style={RIGHT}>
                {c.costPerConversion != null ? formatCurrency(c.costPerConversion, currency) : '—'}
              </td>
              <td style={RIGHT}>
                <i className="bi bi-chevron-right text-[11px]" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
