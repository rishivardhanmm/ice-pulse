'use client';

import { campaignDetailUrl } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import type { CampaignDetailDTO, CampaignDTO } from '@/lib/types';
import { CampaignStatusPill } from '@/components/ui/StatusPill';
import { TrendChart } from '@/components/charts/TrendChart';
import { CampaignAiAnalysis } from '@/components/ai/CampaignAiAnalysis';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChartSkeleton, Skeleton } from '@/components/ui/Skeleton';
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from '@/lib/format';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}>
      <div className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-extrabold" style={{ color: 'var(--section-heading)' }}>
        {value}
      </div>
    </div>
  );
}

export function CampaignDetailDrawer({
  campaign,
  from,
  to,
  onClose,
}: {
  campaign: CampaignDTO | null;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const open = Boolean(campaign);
  const { data, loading, error, refetch } = useFetch<CampaignDetailDTO>(
    campaign ? campaignDetailUrl(campaign.id, from, to) : null,
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`ice-scroll fixed right-0 top-0 z-[70] h-screen w-full max-w-md overflow-y-auto border-l transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-strong)' }}
        aria-hidden={!open}
      >
        {campaign && (
          <div className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Campaign detail
                </p>
                <h2 className="ice-section-title text-lg leading-snug">{campaign.name}</h2>
                <div className="mt-2 flex items-center gap-2">
                  <CampaignStatusPill status={campaign.status} />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {campaign.channelType ?? '—'}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="ice-icon-btn" aria-label="Close detail">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <ChartSkeleton height={200} />
              </div>
            )}

            {error && <ErrorState message={error} onRetry={refetch} />}

            {data && (
              <>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <Stat label="Spend" value={formatCurrency(data.campaign.spend, data.currency)} />
                  <Stat label="Impressions" value={formatCompactNumber(data.campaign.impressions)} />
                  <Stat label="Clicks" value={formatNumber(data.campaign.clicks)} />
                  <Stat label="CTR" value={formatPercent(data.campaign.ctr)} />
                  <Stat label="Conversions" value={formatNumber(data.campaign.conversions)} />
                  <Stat
                    label="Cost / Conv."
                    value={
                      data.campaign.costPerConversion != null
                        ? formatCurrency(data.campaign.costPerConversion, data.currency)
                        : '—'
                    }
                  />
                </div>

                <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}>
                  <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--section-heading)' }}>
                    Daily trend
                  </p>
                  {data.daily.length > 0 ? (
                    <TrendChart points={data.daily} currency={data.currency} />
                  ) : (
                    <p className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      No daily data in this range.
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <CampaignAiAnalysis campaignId={data.campaign.id} from={from} to={to} />
                </div>

                <div className="mt-4 space-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <div>Google campaign ID: {data.campaign.googleCampaignId}</div>
                  <div>Customer ID: {data.campaign.googleCustomerId}</div>
                  {data.campaign.startDate && <div>Start date: {formatDate(data.campaign.startDate)}</div>}
                  {data.campaign.endDate && <div>End date: {formatDate(data.campaign.endDate)}</div>}
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
