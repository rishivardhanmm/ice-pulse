'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChartSkeleton, KpiCardSkeleton } from '@/components/ui/Skeleton';
import { DateRangePicker } from '@/components/controls/DateRangePicker';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { TrendChart } from '@/components/charts/TrendChart';
import { TopCampaignsTable } from '@/components/dashboard/TopCampaignsTable';
import { ClientBudgetGauge } from '@/components/dashboard/ClientBudgetGauge';
import {
  AskPulseChips,
  BudgetPacingCard,
  ClientAiSummary,
  ClientAnomalies,
  MetricGlossary,
} from '@/components/clients/ClientExperience';
import type { BudgetPacingDTO, CampaignDTO, MetricsTotals, TrendPoint } from '@/lib/types';

interface ClientOverviewData {
  client: { id: number; name: string; slug: string };
  dateRange: { from: string; to: string };
  currency: string;
  totals: MetricsTotals;
  previousTotals: MetricsTotals;
  trends: TrendPoint[];
  campaigns: CampaignDTO[];
  campaignCount: number;
  budget: { pctUsed: number; updatedAt: string | null } | null;
  pacing: BudgetPacingDTO | null;
}

function ClientDashboardInner({ slug }: { slug: string }) {
  const session = useSession();
  const sp = useSearchParams();
  const def = defaultRange(30);
  const from = isValidDateStr(sp.get('from')) ? (sp.get('from') as string) : def.from;
  const to = isValidDateStr(sp.get('to')) ? (sp.get('to') as string) : def.to;

  const url = `/api/clients/${slug}/overview?from=${from}&to=${to}`;
  const { data, loading, error, refetch } = useFetch<ClientOverviewData>(url);

  const isInternal =
    session.data?.user?.role === 'admin' || session.data?.user?.role === 'internal';

  return (
    <>
      <PageHeader
        title={data ? data.client.name : 'Client Dashboard'}
        subtitle={
          data
            ? `${data.campaignCount} campaign${data.campaignCount !== 1 ? 's' : ''} · Google Ads performance`
            : 'Loading…'
        }
      >
        <DateRangePicker />
      </PageHeader>

      {/* Internal staff banner */}
      {isInternal && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm"
          style={{
            background: 'var(--gold-subtle)',
            borderColor: 'var(--gold)',
            color: 'var(--text-primary)',
          }}
        >
          <i className="bi bi-eye-fill" style={{ color: 'var(--gold)' }} aria-hidden="true" />
          <span>
            You&apos;re viewing the{' '}
            <strong>{data?.client.name ?? slug}</strong> client view.
          </span>
          <Link href="/" className="ml-auto text-xs font-semibold" style={{ color: 'var(--gold)' }}>
            ← Back to full dashboard
          </Link>
        </div>
      )}

      {error && (
        <Card>
          <ErrorState message={error} onRetry={refetch} />
        </Card>
      )}

      {!error && loading && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
          <Card><ChartSkeleton /></Card>
        </>
      )}

      {!error && !loading && data && (
        <>
          {data.campaignCount === 0 ? (
            <Card>
              <EmptyState
                icon="bi-people"
                title="No campaigns assigned"
                description="Ask an ICE Creates team member to assign campaigns to your account."
              />
            </Card>
          ) : (
            <>
              <KpiGrid
                summary={data.totals}
                previous={data.previousTotals}
                currency={data.currency}
              />

              {/* Plain-English AI narrative of the period */}
              <div className="mt-6">
                <ClientAiSummary slug={slug} from={from} to={to} />
              </div>

              {/* Budget: computed pacing when an amount/goal is set; manual gauge otherwise */}
              {data.pacing && (data.pacing.mode === 'computed' || data.pacing.conversionGoal) ? (
                <div className="mt-6">
                  <BudgetPacingCard pacing={data.pacing} currency={data.currency} />
                </div>
              ) : (
                data.budget && (
                  <div className="mt-6">
                    <Card>
                      <h2 className="ice-section-title mb-4 text-sm">Budget Utilisation</h2>
                      <ClientBudgetGauge
                        pctUsed={data.budget.pctUsed}
                        updatedAt={data.budget.updatedAt}
                        size="lg"
                      />
                    </Card>
                  </div>
                )
              )}

              {/* Unusual movements on their campaigns, in plain English */}
              <div className="mt-6">
                <ClientAnomalies />
              </div>

              <div className="mt-6">
                <Card>
                  <h2 className="ice-section-title mb-4 text-sm">Spend &amp; Click Trend</h2>
                  <TrendChart points={data.trends} currency={data.currency} />
                </Card>
              </div>

              {data.campaigns.length > 0 && (
                <div className="mt-6">
                  <Card>
                    <h2 className="ice-section-title mb-4 text-sm">Campaigns</h2>
                    <TopCampaignsTable campaigns={data.campaigns} currency={data.currency} />
                  </Card>
                </div>
              )}

              {/* Invite them to ask questions + explain the jargon */}
              <div className="mt-6">
                <AskPulseChips />
              </div>
              <div className="mt-6">
                <MetricGlossary />
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export default function ClientDashboardPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={null}>
      <ClientDashboardInner slug={params.slug} />
    </Suspense>
  );
}
