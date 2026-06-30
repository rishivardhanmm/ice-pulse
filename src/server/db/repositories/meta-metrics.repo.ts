import { getPool, sql } from '../pool';

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
