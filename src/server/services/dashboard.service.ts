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
import {
  getMetaCampaignAggregates,
  getMetaCampaignAggregatesForClient,
  getMetaSummaryRaw,
  getMetaSummaryRawForCampaigns,
  getMetaTrendRows,
  getMetaTrendRowsForCampaigns,
  hasAnyMetaMetrics,
} from '../db/repositories/meta-metrics.repo';
import { getGoogleAdsCurrency } from '../db/repositories/platformAccounts.repo';
import { getLastSyncRun } from '../db/repositories/syncRuns.repo';
import { deriveTotals, EMPTY_TOTALS } from '../db/utils';
import { previousRange } from '../../lib/date';
import type {
  CampaignDTO,
  CampaignDetailDTO,
  CampaignListDTO,
  CampaignQuery,
  CampaignSortKey,
  ChannelFilter,
  ConnectionStatusDTO,
  DashboardOverviewDTO,
  MetricsSummaryDTO,
  MetricsTotals,
  TrendPoint,
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

/** Adds two MetricsTotals together (additive fields) and re-derives the ratios. */
export function combineTotals(a: MetricsTotals, b: MetricsTotals): MetricsTotals {
  return deriveTotals({
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
    conversions_value: a.conversionsValue + b.conversionsValue,
  });
}

/** Merges two daily-trend series point-wise by date, recomputing CTR. */
export function combineTrends(a: TrendPoint[], b: TrendPoint[]): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();
  for (const p of [...a, ...b]) {
    const existing = byDate.get(p.date);
    if (!existing) {
      byDate.set(p.date, { ...p });
    } else {
      existing.spend += p.spend;
      existing.impressions += p.impressions;
      existing.clicks += p.clicks;
      existing.conversions += p.conversions;
      existing.ctr = existing.impressions > 0 ? (existing.clicks / existing.impressions) * 100 : 0;
    }
  }
  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
}

/**
 * `campaignIds` undefined = unscoped/global (used only for the account-wide
 * dashboard). `campaignIds` an array (even empty) = scoped — always queries by
 * that exact id list, NEVER falls back to global data. This is what keeps one
 * client's Meta numbers from ever leaking into another's.
 */
async function getMetaSummaryTotals(from: string, to: string, campaignIds?: number[]): Promise<MetricsTotals> {
  const raw = await (campaignIds
    ? getMetaSummaryRawForCampaigns(from, to, campaignIds)
    : getMetaSummaryRaw(from, to)
  ).catch(() => null);
  return raw ? deriveTotals(raw) : EMPTY_TOTALS;
}

/** Meta trend rows mapped into the shared TrendPoint shape. */
export function mapMetaTrendRows(rows: Awaited<ReturnType<typeof getMetaTrendRows>>): TrendPoint[] {
  return rows.map((r) => {
    const impressions = Number(r.impressions);
    const clicks = Number(r.clicks);
    return {
      date: new Date(r.metric_date).toISOString().slice(0, 10),
      spend: Number(r.spend),
      impressions,
      clicks,
      conversions: Number(r.conversions),
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    };
  });
}

async function getMetaTrends(from: string, to: string, campaignIds?: number[]): Promise<TrendPoint[]> {
  const rows = await (campaignIds
    ? getMetaTrendRowsForCampaigns(from, to, campaignIds)
    : getMetaTrendRows(from, to)
  ).catch(() => []);
  return mapMetaTrendRows(rows);
}

/** Meta campaign aggregate rows mapped into the shared CampaignDTO shape (channelType marks them). */
export function mapMetaAggregatesToCampaignDTOs(
  rows: Awaited<ReturnType<typeof getMetaCampaignAggregates>>,
): CampaignDTO[] {
  return rows.map((r) => {
    const spend = Number(r.spend);
    const impressions = Number(r.impressions);
    const clicks = Number(r.clicks);
    const conversions = Number(r.conversions);
    return {
      id: r.id,
      googleCampaignId: r.meta_campaign_id,
      googleCustomerId: '',
      name: r.campaign_name ?? r.meta_campaign_id,
      status: r.campaign_status,
      channelType: 'META',
      startDate: null,
      endDate: null,
      spend,
      impressions,
      clicks,
      ctr: impressions > 0 ? (100 * clicks) / impressions : 0,
      conversions,
      conversionsValue: Number(r.conversions_value),
      costPerConversion: conversions > 0 ? spend / conversions : null,
      averageCpc: clicks > 0 ? spend / clicks : null,
    };
  });
}

/** Meta campaigns mapped into the shared CampaignDTO shape (channelType marks them). */
async function getMetaCampaignsAsDTOs(from: string, to: string, campaignIds?: number[]): Promise<CampaignDTO[]> {
  const rows = await (campaignIds
    ? getMetaCampaignAggregatesForClient(from, to, campaignIds)
    : getMetaCampaignAggregates(from, to)
  ).catch(() => []);
  return mapMetaAggregatesToCampaignDTOs(rows);
}

export async function getDashboardOverview(
  from: string,
  to: string,
  /**
   * When provided (even as an empty array), scope Google metrics to exactly
   * these campaign IDs — used for a single client or an ad-hoc campaign
   * selection. `undefined` means the unscoped, account-wide dashboard.
   */
  googleCampaignIds?: number[],
  /** Which channel(s) to include. */
  channel: ChannelFilter = 'all',
  /**
   * Meta counterpart of googleCampaignIds — scope Meta metrics to exactly
   * these campaign IDs. Passing `undefined` here while googleCampaignIds IS
   * scoped means "this caller has no Meta scoping concept for this call"
   * (e.g. the ad-hoc Google-campaign multi-select), so Meta is left out
   * entirely rather than ever falling back to unscoped/global Meta data.
   */
  metaCampaignIds?: number[],
): Promise<DashboardOverviewDTO> {
  const scopedGoogle = googleCampaignIds !== undefined;
  const prev = previousRange(from, to);

  const effectiveChannel: ChannelFilter = channel;
  const wantGoogle = effectiveChannel !== 'meta';
  const wantMeta = effectiveChannel !== 'google';

  const [
    currency,
    gSummary,
    gTrends,
    gAggregates,
    gHasData,
    connection,
    gPrevSummary,
    mSummary,
    mTrends,
    mAggregates,
    mHasData,
    mPrevSummary,
  ] = await Promise.all([
    resolveCurrency(),
    wantGoogle
      ? scopedGoogle
        ? getSummaryForCampaigns(from, to, googleCampaignIds!)
        : getSummary(from, to)
      : Promise.resolve(EMPTY_TOTALS),
    wantGoogle
      ? scopedGoogle
        ? getTrendsForCampaigns(from, to, googleCampaignIds!)
        : getTrends(from, to)
      : Promise.resolve([] as TrendPoint[]),
    wantGoogle
      ? scopedGoogle
        ? getCampaignAggregatesForClient(from, to, googleCampaignIds!)
        : getCampaignAggregates({ from, to })
      : Promise.resolve([] as CampaignDTO[]),
    wantGoogle ? hasAnyMetrics() : Promise.resolve(false),
    getGoogleAdsConnectionStatus(),
    wantGoogle
      ? scopedGoogle
        ? getSummaryForCampaigns(prev.from, prev.to, googleCampaignIds!)
        : getSummary(prev.from, prev.to)
      : Promise.resolve(EMPTY_TOTALS),
    wantMeta ? getMetaSummaryTotals(from, to, metaCampaignIds) : Promise.resolve(EMPTY_TOTALS),
    wantMeta ? getMetaTrends(from, to, metaCampaignIds) : Promise.resolve([] as TrendPoint[]),
    wantMeta ? getMetaCampaignsAsDTOs(from, to, metaCampaignIds) : Promise.resolve([] as CampaignDTO[]),
    wantMeta
      ? metaCampaignIds
        ? Promise.resolve(metaCampaignIds.length > 0)
        : hasAnyMetaMetrics().catch(() => false)
      : Promise.resolve(false),
    wantMeta ? getMetaSummaryTotals(prev.from, prev.to, metaCampaignIds) : Promise.resolve(EMPTY_TOTALS),
  ]);

  const summary = wantGoogle && wantMeta ? combineTotals(gSummary, mSummary) : wantMeta ? mSummary : gSummary;
  const prevSummary =
    wantGoogle && wantMeta ? combineTotals(gPrevSummary, mPrevSummary) : wantMeta ? mPrevSummary : gPrevSummary;
  const trends = wantGoogle && wantMeta ? combineTrends(gTrends, mTrends) : wantMeta ? mTrends : gTrends;
  const aggregates = [...gAggregates, ...mAggregates];

  const topCampaigns = sortCampaigns(aggregates, 'spend', 'desc').slice(0, 5);

  return {
    dateRange: { from, to },
    currency,
    channel: effectiveChannel,
    summary,
    previous: prevSummary,
    trends,
    topCampaigns,
    lastSyncedAt: connection.lastSuccessAt,
    hasData: gHasData || mHasData,
    googleAds: connection,
    channels: effectiveChannel === 'all' ? { google: gSummary, meta: mSummary } : null,
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
