import { getPool, sql } from '../pool';
import { num, round, toIso } from '../utils';
import type { AiUsageBucket, AiUsageSummaryDTO } from '../../../lib/types';

export interface RecordAiUsageParams {
  feature: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  meta?: Record<string, unknown> | null;
}

export async function recordAiUsage(p: RecordAiUsageParams): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('feature', sql.NVarChar(40), p.feature)
    .input('provider', sql.NVarChar(40), p.provider)
    .input('model', sql.NVarChar(80), p.model)
    .input('pt', sql.Int, Math.round(p.promptTokens))
    .input('ct', sql.Int, Math.round(p.completionTokens))
    .input('tt', sql.Int, Math.round(p.totalTokens))
    .input('cost', sql.Decimal(12, 6), p.estimatedCostUsd)
    .input('meta', sql.NVarChar(sql.MAX), p.meta ? JSON.stringify(p.meta) : null)
    .query(
      `INSERT INTO dbo.ai_usage
         (feature, provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, meta_json)
       VALUES (@feature, @provider, @model, @pt, @ct, @tt, @cost, @meta)`,
    );
}

function bucket(r: Record<string, unknown>, prefix: string): AiUsageBucket {
  return {
    calls: num(r[`${prefix}_calls`]),
    totalTokens: num(r[`${prefix}_tokens`]),
    promptTokens: num(r[`${prefix}_prompt`]),
    completionTokens: num(r[`${prefix}_completion`]),
    costUsd: round(num(r[`${prefix}_cost`]), 6) ?? 0,
  };
}

export type AiUsageData = Omit<AiUsageSummaryDTO, 'enabled' | 'configured' | 'model'>;

/** Aggregated AI token/cost usage: today, this month, all-time, by feature, recent. */
export async function getAiUsageData(): Promise<AiUsageData> {
  const pool = await getPool();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const buckets = await pool
    .request()
    .input('today', sql.DateTime2, todayStart)
    .input('month', sql.DateTime2, monthStart)
    .query(`
      SELECT
        SUM(CASE WHEN created_at >= @today THEN 1 ELSE 0 END)                          AS today_calls,
        SUM(CASE WHEN created_at >= @today THEN CAST(total_tokens AS BIGINT) ELSE 0 END)      AS today_tokens,
        SUM(CASE WHEN created_at >= @today THEN CAST(prompt_tokens AS BIGINT) ELSE 0 END)     AS today_prompt,
        SUM(CASE WHEN created_at >= @today THEN CAST(completion_tokens AS BIGINT) ELSE 0 END) AS today_completion,
        SUM(CASE WHEN created_at >= @today THEN estimated_cost_usd ELSE 0 END)          AS today_cost,
        SUM(CASE WHEN created_at >= @month THEN 1 ELSE 0 END)                          AS month_calls,
        SUM(CASE WHEN created_at >= @month THEN CAST(total_tokens AS BIGINT) ELSE 0 END)      AS month_tokens,
        SUM(CASE WHEN created_at >= @month THEN CAST(prompt_tokens AS BIGINT) ELSE 0 END)     AS month_prompt,
        SUM(CASE WHEN created_at >= @month THEN CAST(completion_tokens AS BIGINT) ELSE 0 END) AS month_completion,
        SUM(CASE WHEN created_at >= @month THEN estimated_cost_usd ELSE 0 END)          AS month_cost,
        COUNT(*)                                          AS all_calls,
        COALESCE(SUM(CAST(total_tokens AS BIGINT)), 0)    AS all_tokens,
        COALESCE(SUM(CAST(prompt_tokens AS BIGINT)), 0)   AS all_prompt,
        COALESCE(SUM(CAST(completion_tokens AS BIGINT)), 0) AS all_completion,
        COALESCE(SUM(estimated_cost_usd), 0)              AS all_cost
      FROM dbo.ai_usage
    `);
  const r = (buckets.recordset[0] ?? {}) as Record<string, unknown>;

  const byFeature = await pool.request().query(`
    SELECT feature, COUNT(*) AS calls,
           COALESCE(SUM(CAST(total_tokens AS BIGINT)), 0) AS tokens,
           COALESCE(SUM(estimated_cost_usd), 0) AS cost
    FROM dbo.ai_usage GROUP BY feature ORDER BY cost DESC
  `);

  const recent = await pool.request().query(`
    SELECT TOP 10 id, feature, model, total_tokens, estimated_cost_usd, created_at
    FROM dbo.ai_usage ORDER BY created_at DESC, id DESC
  `);

  return {
    today: bucket(r, 'today'),
    month: bucket(r, 'month'),
    allTime: bucket(r, 'all'),
    byFeature: byFeature.recordset.map((x) => ({
      feature: String(x.feature),
      calls: num(x.calls),
      totalTokens: num(x.tokens),
      costUsd: round(num(x.cost), 6) ?? 0,
    })),
    recent: recent.recordset.map((x) => ({
      id: Number(x.id),
      feature: String(x.feature),
      model: String(x.model),
      totalTokens: num(x.total_tokens),
      costUsd: round(num(x.estimated_cost_usd), 6) ?? 0,
      createdAt: toIso(x.created_at) ?? new Date().toISOString(),
    })),
  };
}
