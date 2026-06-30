import { isGoogleAdsConfigured } from '../config/env';
import {
  getCampaignAggregateById,
  getCampaignAggregates,
  getCampaignDaily,
  getSummary,
  getSummaryForCampaigns,
  getTrends,
  getTrendsForCampaigns,
  getCampaignAggregatesForClient,
} from '../db/repositories/metrics.repo';
import { getDistinctFilters, hasAnyMetrics } from '../db/repositories/campaigns.repo';
import { getGoogleAdsCurrency } from '../db/repositories/platformAccounts.repo';
import { getLastSyncRun } from '../db/repositories/syncRuns.repo';
import { deriveTotals } from '../db/utils';
import { buildInsights } from './insights';
import { previousRange } from '../../lib/date';
import type {
  CampaignDTO,
  CampaignDetailDTO,
  CampaignListDTO,
  CampaignQuery,
  CampaignSortKey,
  ConnectionStatusDTO,
  DashboardOverviewDTO,
  MetricsSummaryDTO,
  MetricsTotals,
  TrendsDTO,
} from '../../lib/types';

const DEFAULT_CURRENCY = 'GBP';

async function resolveCurrency(): Promise<string> {
  const currency = await getGoogleAdsCurrency();
  return currency ?? DEFAULT_CURRENCY;
}

function metricValue(c: CampaignDTO, key: Exclude<CampaignSortKey, 'name'>): number {
  switch (key) {
    case 'spend':
      return c.spend;
    case 'clicks':
      return c.clicks;
    case 'impressions':
      return c.impressions;
    case 'ctr':
      return c.ctr;
    case 'conversions':
      return c.conversions;
    default:
      return 0;
  }
}

function sortCampaigns(
  campaigns: CampaignDTO[],
  sort: CampaignSortKey,
  direction: 'asc' | 'desc',
): CampaignDTO[] {
  const dir = direction === 'asc' ? 1 : -1;
  return [...campaigns].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name) * dir;
    return (metricValue(a, sort) - metricValue(b, sort)) * dir;
  });
}

function sumTotals(campaigns: CampaignDTO[]): MetricsTotals {
  const raw = campaigns.reduce(
    (acc, c) => {
      acc.spend += c.spend;
      acc.impressions += c.impressions;
      acc.clicks += c.clicks;
      acc.conversions += c.conversions;
      acc.conversions_value += c.conversionsValue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversions_value: 0 },
  );
  return deriveTotals(raw);
}

/** Connection status WITHOUT calling the Google Ads API (derived from config + sync history). */
export async function getGoogleAdsConnectionStatus(): Promise<ConnectionStatusDTO> {
  const configured = isGoogleAdsConfigured();
  const [lastSuccess, lastFailure] = await Promise.all([
    getLastSyncRun('google_ads', 'success'),
    getLastSyncRun('google_ads', 'failed'),
  ]);

  let message: string;
  if (!configured) {
    message = 'Google Ads credentials are not configured. Add them to .env.local (see .env.example).';
  } else if (lastSuccess) {
    message = 'Connected. Campaign data is synced from Google Ads into MSSQL.';
  } else {
    message = 'Credentials detected. Run a sync to pull data from Google Ads.';
  }

  return {
    source: 'google_ads',
    configured,
    connected: configured && Boolean(lastSuccess),
    message,
    lastSuccessAt: lastSuccess?.finishedAt ?? null,
    lastFailureAt: lastFailure?.finishedAt ?? null,
  };
}

export async function getDashboardOverview(
  from: string,
  to: string,
  /** When provided, scope all metrics to these campaign IDs only */
  campaignIds?: number[],
): Promise<DashboardOverviewDTO> {
  const scoped = campaignIds && campaignIds.length > 0;
  const prev = previousRange(from, to);

  const [currency, summary, trends, aggregates, hasData, connection, prevSummary] =
    await Promise.all([
      resolveCurrency(),
      scoped ? getSummaryForCampaigns(from, to, campaignIds!) : getSummary(from, to),
      scoped ? getTrendsForCampaigns(from, to, campaignIds!) : getTrends(from, to),
      scoped
        ? getCampaignAggregatesForClient(from, to, campaignIds!)
        : getCampaignAggregates({ from, to }),
      hasAnyMetrics(),
      getGoogleAdsConnectionStatus(),
      scoped
        ? getSummaryForCampaigns(prev.from, prev.to, campaignIds!)
        : getSummary(prev.from, prev.to),
    ]);

  const topCampaigns = sortCampaigns(aggregates, 'spend', 'desc').slice(0, 5);
  const insights = buildInsights(aggregates, summary, currency);

  return {
    dateRange: { from, to },
    currency,
    summary,
    previous: prevSummary,
    trends,
    topCampaigns,
    insights,
    lastSyncedAt: connection.lastSuccessAt,
    hasData,
    googleAds: connection,
  };
}

export async function getMetricsSummary(from: string, to: string): Promise<MetricsSummaryDTO> {
  const [currency, totals, connection] = await Promise.all([
    resolveCurrency(),
    getSummary(from, to),
    getGoogleAdsConnectionStatus(),
  ]);
  return { dateRange: { from, to }, currency, totals, lastSyncedAt: connection.lastSuccessAt };
}

export async function getTrendsDTO(from: string, to: string): Promise<TrendsDTO> {
  const points = await getTrends(from, to);
  return { dateRange: { from, to }, points };
}

export async function getCampaignList(query: CampaignQuery): Promise<CampaignListDTO> {
  const [currency, aggregates, filters] = await Promise.all([
    resolveCurrency(),
    getCampaignAggregates({
      from: query.from,
      to: query.to,
      status: query.status ?? null,
      channelType: query.channelType ?? null,
      search: query.search ?? null,
    }),
    getDistinctFilters(),
  ]);

  const campaigns = sortCampaigns(aggregates, query.sort, query.direction);

  return {
    dateRange: { from: query.from, to: query.to },
    currency,
    campaigns,
    totals: sumTotals(aggregates),
    filters,
  };
}

export async function getCampaignDetail(
  id: number,
  from: string,
  to: string,
): Promise<CampaignDetailDTO | null> {
  const [currency, campaign] = await Promise.all([
    resolveCurrency(),
    getCampaignAggregateById(id, from, to),
  ]);
  if (!campaign) return null;
  const daily = await getCampaignDaily(id, from, to);
  return { campaign, dateRange: { from, to }, currency, daily };
}
