'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { overviewUrl } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import { defaultRange, isValidDateStr } from '@/lib/date';
import type { DashboardOverviewDTO } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChartSkeleton, KpiCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { DateRangePicker } from '@/components/controls/DateRangePicker';
import { ConfigNotice } from '@/components/common/ConfigNotice';
import { LastSyncBadge } from './LastSyncBadge';
import { KpiGrid } from './KpiGrid';
import { TrendChart } from '@/components/charts/TrendChart';
import { InsightCards } from './InsightCards';
import { TopCampaignsTable } from './TopCampaignsTable';
import { FilterBar } from './FilterBar';
import { PulseAssistant } from './PulseAssistant';
import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel';
import { NeedsAttention } from './NeedsAttention';

export function DashboardView() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const isStaff = session?.user?.role === 'admin' || session?.user?.role === 'internal';

  const def = defaultRange(30);
  const from = isValidDateStr(sp.get('from')) ? sp.get('from')! : def.from;
  const to = isValidDateStr(sp.get('to')) ? sp.get('to')! : def.to;

  const clientId = sp.get('clientId') ? parseInt(sp.get('clientId')!, 10) : null;
  const campaignIds = sp.get('campaignIds')
    ? sp.get('campaignIds')!.split(',').map(Number).filter(Number.isFinite)
    : [];

  const url = overviewUrl(from, to, {
    clientId: isStaff ? clientId : null,
    campaignIds: isStaff && campaignIds.length > 0 ? campaignIds : [],
  });

  const { data, loading, error, refetch } = useFetch<DashboardOverviewDTO>(url);

  return (
    <>
      <PageHeader title="Dashboard Overview" subtitle="Your Google Ads performance at a glance.">
        <DateRangePicker />
        {data && <LastSyncBadge lastSyncedAt={data.lastSyncedAt} />}
      </PageHeader>

      {/* Filter bar — staff only */}
      {isStaff && (
        <div className="mb-4">
          <FilterBar showClientFilter={true} />
        </div>
      )}

      {/* Active filter banner */}
      {isStaff && clientId && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: 'rgba(255,213,0,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,213,0,0.25)' }}
        >
          <i className="bi bi-funnel-fill text-xs" />
          Viewing filtered data
          <button
            onClick={() => {
              const next = new URLSearchParams(sp.toString());
              next.delete('clientId');
              next.delete('campaignIds');
              router.push(`/?${next.toString()}`);
            }}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
          >
            Clear ×
          </button>
        </div>
      )}
      {isStaff && !clientId && campaignIds.length > 0 && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: 'rgba(255,213,0,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,213,0,0.25)' }}
        >
          <i className="bi bi-megaphone-fill text-xs" />
          Viewing {campaignIds.length} selected campaign{campaignIds.length !== 1 ? 's' : ''}
          <button
            onClick={() => {
              const next = new URLSearchParams(sp.toString());
              next.delete('campaignIds');
              router.push(`/?${next.toString()}`);
            }}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
          >
            Clear ×
          </button>
        </div>
      )}

      {error && (
        <Card>
          <ErrorState message={error} onRetry={refetch} />
        </Card>
      )}

      {!error && loading && <DashboardLoading />}

      {!error && !loading && data && (
        <DashboardContent data={data} />
      )}
    </>
  );
}

function DashboardContent({ data }: { data: DashboardOverviewDTO }) {
  return (
    <div className="space-y-6">
      {!data.googleAds.configured && <ConfigNotice />}

      <PulseAssistant overview={data} />

      {data.hasData ? (
        <>
          <KpiGrid summary={data.summary} previous={data.previous} currency={data.currency} />

          <NeedsAttention from={data.dateRange.from} to={data.dateRange.to} />

          <AiInsightsPanel from={data.dateRange.from} to={data.dateRange.to} />

          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="ice-section-title text-base">Performance trend</h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {data.dateRange.from} → {data.dateRange.to}
              </span>
            </div>
            <TrendChart points={data.trends} currency={data.currency} />
          </Card>

          <div>
            <h2 className="ice-section-title mb-3 text-base">Quick insights</h2>
            <InsightCards insights={data.insights} />
          </div>

          <Card padded={false}>
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="ice-section-title text-base">Top campaigns</h2>
              <Link href="/google-ads" className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
                View all →
              </Link>
            </div>
            <div className="px-2 pb-2">
              <TopCampaignsTable campaigns={data.topCampaigns} currency={data.currency} />
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon="bi-cloud-arrow-down"
            title="No campaign data yet"
            description={
              data.googleAds.configured
                ? 'Run your first Google Ads sync to pull campaigns and metrics into the dashboard.'
                : 'Add your Google Ads credentials to .env.local, then run a sync to populate the dashboard.'
            }
            action={
              <Link href="/sync" className="ice-pill-btn-gold">
                <i className="bi bi-arrow-repeat" aria-hidden="true" /> Go to Sync Centre
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <Card>
        <ChartSkeleton />
      </Card>
    </div>
  );
}
