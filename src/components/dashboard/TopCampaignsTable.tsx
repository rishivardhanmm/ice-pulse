'use client';

import { CampaignStatusPill } from '@/components/ui/StatusPill';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { CampaignDTO } from '@/lib/types';

const RIGHT = { textAlign: 'right' as const };

export function TopCampaignsTable({
  campaigns,
  currency,
}: {
  campaigns: CampaignDTO[];
  currency: string;
}) {
  return (
    <div className="ice-scroll overflow-x-auto">
      <table className="ice-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Campaign</th>
            <th>Status</th>
            <th style={RIGHT}>Spend</th>
            <th style={RIGHT}>Clicks</th>
            <th style={RIGHT}>CTR</th>
            <th style={RIGHT}>Conv.</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <tr key={c.id}>
              <td>
                <span className="font-display text-base font-extrabold" style={{ color: 'var(--gold)' }}>
                  {i + 1}
                </span>
              </td>
              <td className="ice-table-strong max-w-[240px] truncate" title={c.name}>
                {c.name}
              </td>
              <td>
                <CampaignStatusPill status={c.status} />
              </td>
              <td style={RIGHT}>{formatCurrency(c.spend, currency)}</td>
              <td style={RIGHT}>{formatNumber(c.clicks)}</td>
              <td style={RIGHT}>{formatPercent(c.ctr)}</td>
              <td style={RIGHT}>{formatNumber(c.conversions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
