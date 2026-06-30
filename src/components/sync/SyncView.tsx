'use client';

import { useSearchParams } from 'next/navigation';
import { googleAdsStatusUrl, metaAdsStatusUrl, syncRunsUrl } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import { defaultRange, isValidDateStr } from '@/lib/date';
import type { ConnectionStatusDTO, SyncRunDTO } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { DateRangePicker } from '@/components/controls/DateRangePicker';
import { ConfigNotice } from '@/components/common/ConfigNotice';
import { SyncStatusCard } from './SyncStatusCard';
import { SyncHistoryTable } from './SyncHistoryTable';
import { RunSyncButton } from './RunSyncButton';
import { RunMetaSyncButton } from './RunMetaSyncButton';
import { AutoSyncCard } from './AutoSyncCard';
import { AiUsageMeter } from '@/components/ai/AiUsageMeter';

interface RunsResponse {
  runs: SyncRunDTO[];
}

export function SyncView() {
  const sp = useSearchParams();
  const def = defaultRange(30);
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const from = isValidDateStr(fromParam) ? (fromParam as string) : def.from;
  const to = isValidDateStr(toParam) ? (toParam as string) : def.to;

  const googleStatusQ = useFetch<ConnectionStatusDTO>(googleAdsStatusUrl());
  const metaStatusQ = useFetch<ConnectionStatusDTO>(metaAdsStatusUrl());
  const runsQ = useFetch<RunsResponse>(syncRunsUrl(50));

  const refetchAll = () => {
    googleStatusQ.refetch();
    metaStatusQ.refetch();
    runsQ.refetch();
  };

  return (
    <>
      <PageHeader title="Sync Centre" subtitle="Connect, run and monitor data syncs into MSSQL.">
        <DateRangePicker />
      </PageHeader>

      {googleStatusQ.data && !googleStatusQ.data.configured && (
        <div className="mb-4">
          <ConfigNotice />
        </div>
      )}

      <div className="space-y-4">
        {/* ── Google Ads ── */}
        {googleStatusQ.error && (
          <Card><ErrorState message={googleStatusQ.error} onRetry={googleStatusQ.refetch} /></Card>
        )}
        {googleStatusQ.loading && !googleStatusQ.data && <Skeleton className="h-32 w-full rounded-xl" />}
        {googleStatusQ.data && (
          <SyncStatusCard
            status={googleStatusQ.data}
            title="Google Ads"
            icon="bi-google"
            iconBg="rgba(66,133,244,0.12)"
            iconColor="#4285F4"
          >
            <RunSyncButton from={from} to={to} onComplete={refetchAll} />
          </SyncStatusCard>
        )}

        {/* ── Meta Ads ── */}
        {metaStatusQ.error && (
          <Card><ErrorState message={metaStatusQ.error} onRetry={metaStatusQ.refetch} /></Card>
        )}
        {metaStatusQ.loading && !metaStatusQ.data && <Skeleton className="h-32 w-full rounded-xl" />}
        {metaStatusQ.data && (
          <SyncStatusCard
            status={metaStatusQ.data}
            title="Meta Ads"
            icon="bi-meta"
            iconBg="rgba(24,119,242,0.12)"
            iconColor="#1877F2"
          >
            <RunMetaSyncButton from={from} to={to} onComplete={refetchAll} />
          </SyncStatusCard>
        )}
      </div>

      <div className="mt-6">
        <AutoSyncCard />
      </div>

      <div className="mt-6">
        <AiUsageMeter />
      </div>

      <div className="mt-6">
        <h2 className="ice-section-title mb-3 text-base">Sync history</h2>
        <Card padded={false}>
          <div className="p-3">
            {runsQ.error && <ErrorState message={runsQ.error} onRetry={runsQ.refetch} />}
            {!runsQ.error && runsQ.loading && (
              <div className="p-2"><TableSkeleton rows={6} cols={6} /></div>
            )}
            {!runsQ.error && !runsQ.loading && runsQ.data && (
              <SyncHistoryTable runs={runsQ.data.runs} />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
