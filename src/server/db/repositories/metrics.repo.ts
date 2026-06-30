import { getPool, sql } from '../pool';
import { deriveTotals, num, parseDateInput, round, toDateString } from '../utils';
import type { CampaignDTO, MetricsTotals, TrendPoint } from '../../../lib/types';

export interface UpsertDailyMetricParams {
  campaignId: number;
  metricDate: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  costMicros: number;
  cost: number;
  conversions: number;
  conversionsValue: number;
  ctr: number | null;
  averageCpc: number | null;
  costPerConversion: number | null;
  conversionRate: number | null;
  rawPayloadJson: string | null;
}

/** Upsert a single campaign/day metric row. Returns whether it was new or updated. */
export async function upsertDailyMetric(
  p: UpsertDailyMetricParams,
): Promise<'INSERT' | 'UPDATE'> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('campaignId', sql.Int, p.campaignId)
    .input('metricDate', sql.Date, parseDateInput(p.metricDate))
    .input('impressions', sql.BigInt, Math.round(p.impressions))
    .input('clicks', sql.BigInt, Math.round(p.clicks))
    .input('costMicros', sql.BigInt, Math.round(p.costMicros))
    .input('cost', sql.Decimal(18, 2), p.cost)
    .input('conversions', sql.Decimal(18, 4), p.conversions)
    .input('conversionsValue', sql.Decimal(18, 4), p.conversionsValue)
    .input('ctr', sql.Decimal(9, 6), p.ctr)
    .input('averageCpc', sql.Decimal(18, 4), p.averageCpc)
    .input('costPerConversion', sql.Decimal(18, 4), p.costPerConversion)
    .input('conversionRate', sql.Decimal(12, 6), p.conversionRate)
    .input('raw', sql.NVarChar(sql.MAX), p.rawPayloadJson)
    .query(`
      MERGE dbo.google_ads_campaign_daily_metrics AS t
      USING (SELECT @campaignId AS campaign_id, @metricDate AS metric_date) AS s
        ON (t.campaign_id = s.campaign_id AND t.metric_date = s.metric_date)
      WHEN MATCHED THEN UPDATE SET
        impressions = @impressions, clicks = @clicks, cost_micros = @costMicros, cost = @cost,
        conversions = @conversions, conversions_value = @conversionsValue,
        ctr = @ctr, average_cpc = @averageCpc, cost_per_conversion = @costPerConversion,
        conversion_rate = @conversionRate, raw_payload_json = @raw,
        updated_at = SYSUTCDATETIME(), last_synced_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (campaign_id, metric_date, impressions, clicks, cost_micros, cost, conversions,
         conversions_value, ctr, average_cpc, cost_per_conversion, conversion_rate,
         raw_payload_json, last_synced_at)
        VALUES (@campaignId, @metricDate, @impressions, @clicks, @costMicros, @cost, @conversions,
                @conversionsValue, @ctr, @averageCpc, @costPerConversion, @conversionRate,
                @raw, SYSUTCDATETIME())
      OUTPUT $action AS action;
    `);
  return String(result.recordset[0].action) as 'INSERT' | 'UPDATE';
}

function mapCampaignAggregate(r: Record<string, unknown>): CampaignDTO {
  const spend = round(num(r.spend)) ?? 0;
  const impressions = Math.round(num(r.impressions));
  const clicks = Math.round(num(r.clicks));
  const conversions = round(num(r.conversions)) ?? 0;
  const conversionsValue = round(num(r.conversions_value)) ?? 0;
  return {
    id: Number(r.id),
    googleCampaignId: String(r.google_campaign_id),
    googleCustomerId: String(r.google_customer_id),
    name: (r.campaign_name as string) ?? '(unnamed campaign)',
    status: (r.campaign_status as string) ?? null,
    channelType: (r.advertising_channel_type as string) ?? null,
    startDate: toDateString(r.start_date),
    endDate: toDateString(r.end_date),
    spend,
    impressions,
    clicks,
    conversions,
    conversionsValue,
    ctr: round(impressions > 0 ? (clicks / impressions) * 100 : 0) ?? 0,
    costPerConversion: conversions > 0 ? round(spend / conversions) : null,
    averageCpc: clicks > 0 ? round(spend / clicks) : null,
  };
}

function mapTrendPoint(r: Record<string, unknown>): TrendPoint {
  const impressions = num(r.impressions);
  const clicks = num(r.clicks);
  return {
    date: toDateString(r.metric_date) ?? '',
    spend: round(num(r.spend)) ?? 0,
    impressions: Math.round(impressions),
    clicks: Math.round(clicks),
    conversions: round(num(r.conversions)) ?? 0,
    ctr: round(impressions > 0 ? (clicks / impressions) * 100 : 0) ?? 0,
  };
}

/** Totals across all campaigns in [from, to]. */
export async function getSummary(from: string, to: string): Promise<MetricsTotals> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('from', sql.Date, parseDateInput(from))
    .input('to', sql.Date, parseDateInput(to))
    .query(`
      SELECT
        COALESCE(SUM(cost), 0)              AS spend,
        COALESCE(SUM(impressions), 0)       AS impressions,
        COALESCE(SUM(clicks), 0)            AS clicks,
        COALESCE(SUM(conversions), 0)       AS conversions,
        COALESCE(SUM(conversions_value), 0) AS conversions_value
      FROM dbo.google_ads_campaign_daily_metrics
      WHERE metric_date BETWEEN @from AND @to
    `);
  return deriveTotals(result.recordset[0]);
}

/** Daily totals across all campaigns in [from, to]. */
export async function getTrends(from: string, to: string): Promise<TrendPoint[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('from', sql.Date, parseDateInput(from))
    .input('to', sql.Date, parseDateInput(to))
    .query(`
      SELECT metric_date,
        SUM(cost)        AS spend,
        SUM(impressions) AS impressions,
        SUM(clicks)      AS clicks,
        SUM(conversions) AS conversions
      FROM dbo.google_ads_campaign_daily_metrics
      WHERE metric_date BETWEEN @from AND @to
      GROUP BY metric_date
      ORDER BY metric_date
    `);
  return result.recordset.map(mapTrendPoint);
}

export interface CampaignAggregateFilters {
  from: string;
  to: string;
  status?: string | null;
  channelType?: string | null;
  search?: string | null;
}

/** Per-campaign aggregated metrics over the range (caller sorts/slices). */
export async function getCampaignAggregates(
  filters: CampaignAggregateFilters,
): Promise<CampaignDTO[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('from', sql.Date, parseDateInput(filters.from))
    .input('to', sql.Date, parseDateInput(filters.to))
    .input('status', sql.NVarChar(40), filters.status ?? null)
    .input('channel', sql.NVarChar(64), filters.channelType ?? null)
    .input('search', sql.NVarChar(512), filters.search ? `%${filters.search}%` : null)
    .query(`
      SELECT c.id, c.google_campaign_id, c.google_customer_id, c.campaign_name,
             c.campaign_status, c.advertising_channel_type, c.start_date, c.end_date,
             COALESCE(SUM(m.cost), 0)              AS spend,
             COALESCE(SUM(m.impressions), 0)       AS impressions,
             COALESCE(SUM(m.clicks), 0)            AS clicks,
             COALESCE(SUM(m.conversions), 0)       AS conversions,
             COALESCE(SUM(m.conversions_value), 0) AS conversions_value
      FROM dbo.google_ads_campaigns c
      LEFT JOIN dbo.google_ads_campaign_daily_metrics m
        ON m.campaign_id = c.id AND m.metric_date BETWEEN @from AND @to
      WHERE (@status  IS NULL OR c.campaign_status = @status)
        AND (@channel IS NULL OR c.advertising_channel_type = @channel)
        AND (@search  IS NULL OR c.campaign_name LIKE @search)
      GROUP BY c.id, c.google_campaign_id, c.google_customer_id, c.campaign_name,
               c.campaign_status, c.advertising_channel_type, c.start_date, c.end_date
    `);
  return result.recordset.map(mapCampaignAggregate);
}

/** Single campaign aggregate over the range, or null if it does not exist. */
export async function getCampaignAggregateById(
  id: number,
  from: string,
  to: string,
): Promise<CampaignDTO | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('from', sql.Date, parseDateInput(from))
    .input('to', sql.Date, parseDateInput(to))
    .query(`
      SELECT c.id, c.google_campaign_id, c.google_customer_id, c.campaign_name,
             c.campaign_status, c.advertising_channel_type, c.start_date, c.end_date,
             COALESCE(SUM(m.cost), 0)              AS spend,
             COALESCE(SUM(m.impressions), 0)       AS impressions,
             COALESCE(SUM(m.clicks), 0)            AS clicks,
             COALESCE(SUM(m.conversions), 0)       AS conversions,
             COALESCE(SUM(m.conversions_value), 0) AS conversions_value
      FROM dbo.google_ads_campaigns c
      LEFT JOIN dbo.google_ads_campaign_daily_metrics m
        ON m.campaign_id = c.id AND m.metric_date BETWEEN @from AND @to
      WHERE c.id = @id
      GROUP BY c.id, c.google_campaign_id, c.google_customer_id, c.campaign_name,
               c.campaign_status, c.advertising_channel_type, c.start_date, c.end_date
    `);
  return result.recordset.length ? mapCampaignAggregate(result.recordset[0]) : null;
}

// ── Client-scoped variants ────────────────────────────────────────────────────
// campaignIds must be validated integers before being embedded in SQL.

function inClause(ids: number[]): string {
  return ids.map((n) => Math.trunc(n)).filter((n) => Number.isFinite(n)).join(',');
}

/** Totals scoped to a set of campaign IDs. */
export async function getSummaryForCampaigns(
  from: string,
  to: string,
  campaignIds: number[],
): Promise<MetricsTotals> {
  if (campaignIds.length === 0) return deriveTotals({});
  const pool = await getPool();
  const result = await pool
    .request()
    .input('from', sql.Date, parseDateInput(from))
    .input('to', sql.Date, parseDateInput(to))
    .query(`
      SELECT
        COALESCE(SUM(cost), 0)              AS spend,
        COALESCE(SUM(impressions), 0)       AS impressions,
        COALESCE(SUM(clicks), 0)            AS clicks,
        COALESCE(SUM(conversions), 0)       AS conversions,
        COALESCE(SUM(conversions_value), 0) AS conversions_value
      FROM dbo.google_ads_campaign_daily_metrics
      WHERE metric_date BETWEEN @from AND @to
        AND campaign_id IN (${inClause(campaignIds)})
    `);
  return deriveTotals(result.recordset[0]);
}

/** Daily trends scoped to a set of campaign IDs. */
export async function getTrendsForCampaigns(
  from: string,
  to: string,
  campaignIds: number[],
): Promise<TrendPoint[]> {
  if (campaignIds.length === 0) return [];
  const pool = await getPool();
  const result = await pool
    .request()
    .input('from', sql.Date, parseDateInput(from))
    .input('to', sql.Date, parseDateInput(to))
    .query(`
      SELECT metric_date,
        SUM(cost)        AS spend,
        SUM(impressions) AS impressions,
        SUM(clicks)      AS clicks,
        SUM(conversions) AS conversions
      FROM dbo.google_ads_campaign_daily_metrics
      WHERE metric_date BETWEEN @from AND @to
        AND campaign_id IN (${inClause(campaignIds)})
      GROUP BY metric_date
      ORDER BY metric_date
    `);
  return result.recordset.map(mapTrendPoint);
}

/** Per-campaign aggregates scoped to a set of campaign IDs. */
export async function getCampaignAggregatesForClient(
  from: string,
  to: string,
  campaignIds: number[],
): Promise<CampaignDTO[]> {
  if (campaignIds.length === 0) return [];
  const pool = await getPool();
  const result = await pool
    .request()
    .input('from', sql.Date, parseDateInput(from))
    .input('to', sql.Date, parseDateInput(to))
    .query(`
      SELECT c.id, c.google_campaign_id, c.google_customer_id, c.campaign_name,
             c.campaign_status, c.advertising_channel_type, c.start_date, c.end_date,
             COALESCE(SUM(m.cost), 0)              AS spend,
             COALESCE(SUM(m.impressions), 0)       AS impressions,
             COALESCE(SUM(m.clicks), 0)            AS clicks,
             COALESCE(SUM(m.conversions), 0)       AS conversions,
             COALESCE(SUM(m.conversions_value), 0) AS conversions_value
      FROM dbo.google_ads_campaigns c
      LEFT JOIN dbo.google_ads_campaign_daily_metrics m
        ON m.campaign_id = c.id AND m.metric_date BETWEEN @from AND @to
      WHERE c.id IN (${inClause(campaignIds)})
      GROUP BY c.id, c.google_campaign_id, c.google_customer_id, c.campaign_name,
               c.campaign_status, c.advertising_channel_type, c.start_date, c.end_date
    `);
  return result.recordset.map(mapCampaignAggregate);
}

/** Daily series for a single campaign over the range. */
export async function getCampaignDaily(
  id: number,
  from: string,
  to: string,
): Promise<TrendPoint[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('from', sql.Date, parseDateInput(from))
    .input('to', sql.Date, parseDateInput(to))
    .query(`
      SELECT metric_date,
        cost        AS spend,
        impressions AS impressions,
        clicks      AS clicks,
        conversions AS conversions
      FROM dbo.google_ads_campaign_daily_metrics
      WHERE campaign_id = @id AND metric_date BETWEEN @from AND @to
      ORDER BY metric_date
    `);
  return result.recordset.map(mapTrendPoint);
}
