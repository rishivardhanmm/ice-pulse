import { getPool, sql } from '../pool';

/**
 * AI Anomaly Watch storage + the detection query.
 *
 * Detection is fully deterministic SQL/JS (zero AI tokens): for each
 * campaign/day in the scan window we fetch the trailing 28-day baseline
 * (mean + stdev per metric) and the service layer flags outliers by z-score.
 * Only the plain-English narrative is AI-written, in one batched call.
 */

export type AnomalySource = 'google_ads' | 'meta_ads';

export interface AnomalyCandidateRow {
  campaign_id: number;
  campaign_name: string;
  metric_date: Date;
  spend: number;
  clicks: number;
  conversions: number;
  avg_spend: number | null;
  std_spend: number | null;
  avg_clicks: number | null;
  std_clicks: number | null;
  avg_conversions: number | null;
  std_conversions: number | null;
  days_in_baseline: number;
}

export interface NewAnomaly {
  source: AnomalySource;
  campaignId: number;
  campaignName: string;
  metric: 'spend' | 'clicks' | 'conversions';
  metricDate: string; // YYYY-MM-DD
  actualValue: number;
  expectedValue: number;
  zScore: number;
  direction: 'spike' | 'drop';
  severity: 'high' | 'medium';
}

export interface AnomalyRow {
  id: number;
  source: AnomalySource;
  campaign_name: string;
  metric: string;
  metric_date: Date;
  actual_value: number;
  expected_value: number;
  z_score: number;
  direction: 'spike' | 'drop';
  severity: 'high' | 'medium';
  narrative: string | null;
}

const SOURCE_TABLES: Record<AnomalySource, { metrics: string; campaigns: string; spendCol: string }> = {
  google_ads: {
    metrics: 'dbo.google_ads_campaign_daily_metrics',
    campaigns: 'dbo.google_ads_campaigns',
    spendCol: 'cost',
  },
  meta_ads: {
    metrics: 'dbo.meta_ads_campaign_daily_metrics',
    campaigns: 'dbo.meta_ads_campaigns',
    spendCol: 'spend',
  },
};

/**
 * Each campaign/day in [from, to] together with its trailing 28-day baseline
 * (needs >= 7 baseline days so brand-new campaigns don't alert immediately).
 */
export async function getAnomalyCandidates(
  source: AnomalySource,
  from: string,
  to: string,
): Promise<AnomalyCandidateRow[]> {
  const t = SOURCE_TABLES[source];
  const pool = await getPool();
  const res = await pool
    .request()
    .input('from', sql.Date, from)
    .input('to', sql.Date, to)
    .query(`
      SELECT
        c.id AS campaign_id,
        c.campaign_name,
        m.metric_date,
        CAST(m.${t.spendCol} AS FLOAT)  AS spend,
        CAST(m.clicks AS FLOAT)         AS clicks,
        CAST(m.conversions AS FLOAT)    AS conversions,
        b.avg_spend, b.std_spend,
        b.avg_clicks, b.std_clicks,
        b.avg_conversions, b.std_conversions,
        b.days_in_baseline
      FROM ${t.metrics} m
      JOIN ${t.campaigns} c ON c.id = m.campaign_id
      CROSS APPLY (
        SELECT
          AVG(CAST(p.${t.spendCol} AS FLOAT))  AS avg_spend,
          STDEV(CAST(p.${t.spendCol} AS FLOAT)) AS std_spend,
          AVG(CAST(p.clicks AS FLOAT))          AS avg_clicks,
          STDEV(CAST(p.clicks AS FLOAT))        AS std_clicks,
          AVG(CAST(p.conversions AS FLOAT))     AS avg_conversions,
          STDEV(CAST(p.conversions AS FLOAT))   AS std_conversions,
          COUNT(*)                              AS days_in_baseline
        FROM ${t.metrics} p
        WHERE p.campaign_id = m.campaign_id
          AND p.metric_date >= DATEADD(day, -28, m.metric_date)
          AND p.metric_date < m.metric_date
      ) b
      WHERE m.metric_date BETWEEN @from AND @to
        AND b.days_in_baseline >= 7
    `);
  return res.recordset as AnomalyCandidateRow[];
}

/** Inserts anomalies, skipping ones already recorded. Returns the inserted ids in input order (null when skipped). */
export async function insertAnomalies(rows: NewAnomaly[]): Promise<Array<number | null>> {
  const pool = await getPool();
  const ids: Array<number | null> = [];
  for (const a of rows) {
    const res = await pool
      .request()
      .input('source', sql.NVarChar(20), a.source)
      .input('campaignId', sql.Int, a.campaignId)
      .input('campaignName', sql.NVarChar(512), a.campaignName)
      .input('metric', sql.NVarChar(40), a.metric)
      .input('metricDate', sql.Date, a.metricDate)
      .input('actual', sql.Decimal(18, 4), a.actualValue)
      .input('expected', sql.Decimal(18, 4), a.expectedValue)
      .input('z', sql.Decimal(9, 3), a.zScore)
      .input('direction', sql.NVarChar(10), a.direction)
      .input('severity', sql.NVarChar(10), a.severity)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.ai_anomalies
          WHERE source = @source AND campaign_id = @campaignId AND metric = @metric AND metric_date = @metricDate
        )
          INSERT INTO dbo.ai_anomalies
            (source, campaign_id, campaign_name, metric, metric_date, actual_value, expected_value, z_score, direction, severity)
          OUTPUT INSERTED.id
          VALUES (@source, @campaignId, @campaignName, @metric, @metricDate, @actual, @expected, @z, @direction, @severity)
      `);
    const row = res.recordset?.[0] as { id: number } | undefined;
    ids.push(row?.id ?? null);
  }
  return ids;
}

export async function setAnomalyNarrative(id: number, narrative: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('narrative', sql.NVarChar(1000), narrative)
    .query('UPDATE dbo.ai_anomalies SET narrative = @narrative WHERE id = @id');
}

/**
 * Recent anomalies for ONE channel restricted to specific campaign ids — used
 * for the client dashboard so clients only ever see their own campaigns.
 * `source` disambiguates the id space (Google and Meta campaign ids are
 * unrelated integers, so this must never be called without it).
 */
export async function listRecentAnomaliesForCampaigns(
  days: number,
  campaignIds: number[],
  source: AnomalySource,
): Promise<AnomalyRow[]> {
  if (campaignIds.length === 0) return [];
  const pool = await getPool();
  const req = pool.request().input('days', sql.Int, days).input('source', sql.NVarChar(20), source);
  const placeholders = campaignIds.map((id, i) => {
    req.input(`c${i}`, sql.Int, id);
    return `@c${i}`;
  });
  const res = await req.query(`
    SELECT TOP (20) id, source, campaign_name, metric, metric_date,
           actual_value, expected_value, z_score, direction, severity, narrative
    FROM dbo.ai_anomalies
    WHERE source = @source
      AND campaign_id IN (${placeholders.join(',')})
      AND metric_date >= DATEADD(day, -@days, CAST(GETUTCDATE() AS DATE))
    ORDER BY metric_date DESC,
             CASE severity WHEN 'high' THEN 0 ELSE 1 END,
             ABS(z_score) DESC
  `);
  return res.recordset as AnomalyRow[];
}

export async function listRecentAnomalies(days: number): Promise<AnomalyRow[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('days', sql.Int, days)
    .query(`
      SELECT TOP (30) id, source, campaign_name, metric, metric_date,
             actual_value, expected_value, z_score, direction, severity, narrative
      FROM dbo.ai_anomalies
      WHERE metric_date >= DATEADD(day, -@days, CAST(GETUTCDATE() AS DATE))
      ORDER BY metric_date DESC,
               CASE severity WHEN 'high' THEN 0 ELSE 1 END,
               ABS(z_score) DESC
    `);
  return res.recordset as AnomalyRow[];
}
