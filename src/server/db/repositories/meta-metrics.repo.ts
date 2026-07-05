import { getPool, sql } from '../pool';

// ── Campaign aggregates (Meta Ads page) ───────────────────────────────────────

export interface MetaCampaignAggregateRow {
  id: number;
  meta_campaign_id: string;
  campaign_name: string | null;
  campaign_status: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversions_value: number;
}

/**
 * One row per Meta campaign with metrics summed over [from, to]. LEFT JOIN so
 * campaigns with no delivery in the window still appear (all zeros) — the
 * campaign list should show everything that exists on the ad account.
 */
export async function getMetaCampaignAggregates(from: string, to: string): Promise<MetaCampaignAggregateRow[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('from', sql.Date, from)
    .input('to', sql.Date, to)
    .query(`
      SELECT c.id, c.meta_campaign_id, c.campaign_name, c.campaign_status, c.objective,
             ISNULL(SUM(m.spend), 0)             AS spend,
             ISNULL(SUM(m.impressions), 0)       AS impressions,
             ISNULL(SUM(m.clicks), 0)            AS clicks,
             ISNULL(SUM(m.conversions), 0)       AS conversions,
             ISNULL(SUM(m.conversions_value), 0) AS conversions_value
      FROM dbo.meta_ads_campaigns c
      LEFT JOIN dbo.meta_ads_campaign_daily_metrics m
        ON m.campaign_id = c.id AND m.metric_date BETWEEN @from AND @to
      GROUP BY c.id, c.meta_campaign_id, c.campaign_name, c.campaign_status, c.objective
      ORDER BY SUM(m.spend) DESC
    `);
  return res.recordset as MetaCampaignAggregateRow[];
}

// ── Dashboard aggregates ──────────────────────────────────────────────────────

export interface MetaRawTotals {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversions_value: number;
}

/** Raw additive totals across all Meta campaigns in [from, to]. */
export async function getMetaSummaryRaw(from: string, to: string): Promise<MetaRawTotals> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('from', sql.Date, from)
    .input('to', sql.Date, to)
    .query(`
      SELECT
        COALESCE(SUM(spend), 0)             AS spend,
        COALESCE(SUM(impressions), 0)       AS impressions,
        COALESCE(SUM(clicks), 0)            AS clicks,
        COALESCE(SUM(conversions), 0)       AS conversions,
        COALESCE(SUM(conversions_value), 0) AS conversions_value
      FROM dbo.meta_ads_campaign_daily_metrics
      WHERE metric_date BETWEEN @from AND @to
    `);
  const r = res.recordset[0] as Record<string, unknown>;
  return {
    spend: Number(r.spend),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    conversions: Number(r.conversions),
    conversions_value: Number(r.conversions_value),
  };
}

export interface MetaTrendRow {
  metric_date: Date;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** Daily totals across all Meta campaigns in [from, to]. */
export async function getMetaTrendRows(from: string, to: string): Promise<MetaTrendRow[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('from', sql.Date, from)
    .input('to', sql.Date, to)
    .query(`
      SELECT metric_date,
        SUM(spend)       AS spend,
        SUM(impressions) AS impressions,
        SUM(clicks)      AS clicks,
        SUM(conversions) AS conversions
      FROM dbo.meta_ads_campaign_daily_metrics
      WHERE metric_date BETWEEN @from AND @to
      GROUP BY metric_date
      ORDER BY metric_date
    `);
  return res.recordset as MetaTrendRow[];
}

/** True when any Meta daily metric rows exist at all. */
export async function hasAnyMetaMetrics(): Promise<boolean> {
  const pool = await getPool();
  const res = await pool
    .request()
    .query('SELECT TOP 1 1 AS x FROM dbo.meta_ads_campaign_daily_metrics');
  return res.recordset.length > 0;
}

// ── Admin assignment (mirrors campaigns.repo.ts for the Client Management UI) ─

export interface MetaCampaignWithAssignment {
  id: number;
  metaCampaignId: string;
  campaignName: string | null;
  campaignStatus: string | null;
  clientId: number | null;
  clientName: string | null;
  clientSlug: string | null;
}

/** All Meta campaigns with their current client assignment (or null = unassigned). */
export async function listMetaCampaignsWithAssignment(): Promise<MetaCampaignWithAssignment[]> {
  const pool = await getPool();
  const res = await pool.request().query(`
    SELECT c.id, c.meta_campaign_id, c.campaign_name, c.campaign_status,
           c.client_id, cl.name AS client_name, cl.slug AS client_slug
    FROM dbo.meta_ads_campaigns c
    LEFT JOIN dbo.clients cl ON cl.id = c.client_id
    ORDER BY c.campaign_name
  `);
  return res.recordset.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    metaCampaignId: String(r.meta_campaign_id),
    campaignName: (r.campaign_name as string) ?? null,
    campaignStatus: (r.campaign_status as string) ?? null,
    clientId: r.client_id != null ? Number(r.client_id) : null,
    clientName: (r.client_name as string) ?? null,
    clientSlug: (r.client_slug as string) ?? null,
  }));
}

/** Assign (or unassign) a Meta campaign to a client. Pass null clientId to unassign. */
export async function assignMetaCampaignToClient(campaignId: number, clientId: number | null): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, campaignId)
    .input('clientId', sql.Int, clientId)
    .query(
      `UPDATE dbo.meta_ads_campaigns SET client_id = @clientId, updated_at = SYSUTCDATETIME() WHERE id = @id`,
    );
}

// ── Client scoping (mirrors campaigns.repo.ts getCampaignIdsForClient) ────────

/** Meta campaign ids assigned to a client — same idea as Google's getCampaignIdsForClient. */
export async function getMetaCampaignIdsForClient(clientId: number): Promise<number[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('clientId', sql.Int, clientId)
    .query('SELECT id FROM dbo.meta_ads_campaigns WHERE client_id = @clientId');
  return res.recordset.map((r: Record<string, unknown>) => Number(r.id));
}

/** Raw additive totals for specific Meta campaign ids. Empty list -> zero totals (no query). */
export async function getMetaSummaryRawForCampaigns(
  from: string,
  to: string,
  campaignIds: number[],
): Promise<MetaRawTotals> {
  const zero: MetaRawTotals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversions_value: 0 };
  if (campaignIds.length === 0) return zero;

  const pool = await getPool();
  const req = pool.request().input('from', sql.Date, from).input('to', sql.Date, to);
  const placeholders = campaignIds.map((id, i) => {
    req.input(`c${i}`, sql.Int, id);
    return `@c${i}`;
  });
  const res = await req.query(`
    SELECT
      COALESCE(SUM(m.spend), 0)             AS spend,
      COALESCE(SUM(m.impressions), 0)       AS impressions,
      COALESCE(SUM(m.clicks), 0)            AS clicks,
      COALESCE(SUM(m.conversions), 0)       AS conversions,
      COALESCE(SUM(m.conversions_value), 0) AS conversions_value
    FROM dbo.meta_ads_campaign_daily_metrics m
    WHERE m.metric_date BETWEEN @from AND @to
      AND m.campaign_id IN (${placeholders.join(',')})
  `);
  const r = res.recordset[0] as Record<string, unknown>;
  return {
    spend: Number(r.spend),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    conversions: Number(r.conversions),
    conversions_value: Number(r.conversions_value),
  };
}

/** Daily totals for specific Meta campaign ids. Empty list -> no rows (no query). */
export async function getMetaTrendRowsForCampaigns(
  from: string,
  to: string,
  campaignIds: number[],
): Promise<MetaTrendRow[]> {
  if (campaignIds.length === 0) return [];

  const pool = await getPool();
  const req = pool.request().input('from', sql.Date, from).input('to', sql.Date, to);
  const placeholders = campaignIds.map((id, i) => {
    req.input(`c${i}`, sql.Int, id);
    return `@c${i}`;
  });
  const res = await req.query(`
    SELECT m.metric_date,
      SUM(m.spend)       AS spend,
      SUM(m.impressions) AS impressions,
      SUM(m.clicks)      AS clicks,
      SUM(m.conversions) AS conversions
    FROM dbo.meta_ads_campaign_daily_metrics m
    WHERE m.metric_date BETWEEN @from AND @to
      AND m.campaign_id IN (${placeholders.join(',')})
    GROUP BY m.metric_date
    ORDER BY m.metric_date
  `);
  return res.recordset as MetaTrendRow[];
}

/** Per-campaign aggregates restricted to specific Meta campaign ids. Empty list -> no rows. */
export async function getMetaCampaignAggregatesForClient(
  from: string,
  to: string,
  campaignIds: number[],
): Promise<MetaCampaignAggregateRow[]> {
  if (campaignIds.length === 0) return [];

  const pool = await getPool();
  const req = pool.request().input('from', sql.Date, from).input('to', sql.Date, to);
  const placeholders = campaignIds.map((id, i) => {
    req.input(`c${i}`, sql.Int, id);
    return `@c${i}`;
  });
  const res = await req.query(`
    SELECT c.id, c.meta_campaign_id, c.campaign_name, c.campaign_status, c.objective,
           ISNULL(SUM(m.spend), 0)             AS spend,
           ISNULL(SUM(m.impressions), 0)       AS impressions,
           ISNULL(SUM(m.clicks), 0)            AS clicks,
           ISNULL(SUM(m.conversions), 0)       AS conversions,
           ISNULL(SUM(m.conversions_value), 0) AS conversions_value
    FROM dbo.meta_ads_campaigns c
    LEFT JOIN dbo.meta_ads_campaign_daily_metrics m
      ON m.campaign_id = c.id AND m.metric_date BETWEEN @from AND @to
    WHERE c.id IN (${placeholders.join(',')})
    GROUP BY c.id, c.meta_campaign_id, c.campaign_name, c.campaign_status, c.objective
    ORDER BY SUM(m.spend) DESC
  `);
  return res.recordset as MetaCampaignAggregateRow[];
}

// ── Campaign upsert ───────────────────────────────────────────────────────────

export interface UpsertMetaCampaignParams {
  platformAccountId: number;
  metaAccountId: string;
  metaCampaignId: string;
  name?: string | null;
  status?: string | null;
  objective?: string | null;
}

/** Upsert a Meta campaign by (account id, campaign id). Returns the DB row id. */
export async function upsertMetaCampaign(p: UpsertMetaCampaignParams): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('platformAccountId', sql.Int, p.platformAccountId)
    .input('accountId', sql.NVarChar(64), p.metaAccountId)
    .input('campaignId', sql.NVarChar(64), p.metaCampaignId)
    .input('name', sql.NVarChar(512), p.name ?? null)
    .input('status', sql.NVarChar(40), p.status ?? null)
    .input('objective', sql.NVarChar(100), p.objective ?? null)
    .query(`
      MERGE dbo.meta_ads_campaigns AS t
      USING (SELECT @accountId AS meta_account_id, @campaignId AS meta_campaign_id) AS s
        ON (t.meta_account_id = s.meta_account_id AND t.meta_campaign_id = s.meta_campaign_id)
      WHEN MATCHED THEN UPDATE SET
        platform_account_id = @platformAccountId,
        campaign_name       = @name,
        campaign_status     = @status,
        objective           = @objective,
        updated_at          = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (platform_account_id, meta_account_id, meta_campaign_id, campaign_name, campaign_status, objective)
        VALUES (@platformAccountId, @accountId, @campaignId, @name, @status, @objective)
      OUTPUT inserted.id AS id;
    `);
  return Number(result.recordset[0].id);
}

// ── Daily metrics upsert ──────────────────────────────────────────────────────

export interface UpsertMetaDailyMetricParams {
  campaignId: number;
  metricDate: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  reach: number | null;
  spend: number;
  conversions: number;
  conversionsValue: number;
  ctr: number | null;
  cpc: number | null;
  costPerConversion: number | null;
  rawPayloadJson: string | null;
}

export async function upsertMetaDailyMetric(
  p: UpsertMetaDailyMetricParams,
): Promise<'INSERT' | 'UPDATE'> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('campaignId', sql.Int, p.campaignId)
    .input('metricDate', sql.Date, new Date(`${p.metricDate}T00:00:00.000Z`))
    .input('impressions', sql.BigInt, Math.round(p.impressions))
    .input('clicks', sql.BigInt, Math.round(p.clicks))
    .input('reach', sql.BigInt, p.reach !== null ? Math.round(p.reach) : null)
    .input('spend', sql.Decimal(18, 2), p.spend)
    .input('conversions', sql.Decimal(18, 4), p.conversions)
    .input('conversionsValue', sql.Decimal(18, 4), p.conversionsValue)
    .input('ctr', sql.Decimal(9, 6), p.ctr)
    .input('cpc', sql.Decimal(18, 4), p.cpc)
    .input('costPerConversion', sql.Decimal(18, 4), p.costPerConversion)
    .input('raw', sql.NVarChar(sql.MAX), p.rawPayloadJson)
    .query(`
      MERGE dbo.meta_ads_campaign_daily_metrics AS t
      USING (SELECT @campaignId AS campaign_id, @metricDate AS metric_date) AS s
        ON (t.campaign_id = s.campaign_id AND t.metric_date = s.metric_date)
      WHEN MATCHED THEN UPDATE SET
        impressions          = @impressions,
        clicks               = @clicks,
        reach                = @reach,
        spend                = @spend,
        conversions          = @conversions,
        conversions_value    = @conversionsValue,
        ctr                  = @ctr,
        cpc                  = @cpc,
        cost_per_conversion  = @costPerConversion,
        raw_payload_json     = @raw,
        updated_at           = SYSUTCDATETIME(),
        last_synced_at       = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (campaign_id, metric_date, impressions, clicks, reach, spend,
         conversions, conversions_value, ctr, cpc, cost_per_conversion,
         raw_payload_json, last_synced_at)
        VALUES (@campaignId, @metricDate, @impressions, @clicks, @reach, @spend,
                @conversions, @conversionsValue, @ctr, @cpc, @costPerConversion,
                @raw, SYSUTCDATETIME())
      OUTPUT $action AS action;
    `);
  return String(result.recordset[0].action) as 'INSERT' | 'UPDATE';
}
