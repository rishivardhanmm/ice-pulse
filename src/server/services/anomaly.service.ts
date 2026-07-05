import {
  getAnomalyCandidates,
  insertAnomalies,
  listRecentAnomalies,
  listRecentAnomaliesForCampaigns,
  setAnomalyNarrative,
  type AnomalySource,
  type NewAnomaly,
} from '../db/repositories/anomalies.repo';
import { runAi } from '../../ai/run';
import { logger, toErrorMessage } from '../logger';
import type { AnomalyDTO } from '../../lib/types';

/**
 * AI Anomaly Watch.
 *
 * Detection is deterministic (z-score against each campaign's own trailing
 * 28-day baseline — no tokens spent). Only genuinely new anomalies get a
 * plain-English narrative, written in ONE batched AI call per run.
 */

const Z_MEDIUM = 2.5;
const Z_HIGH = 3.5;

// Materiality floors so tiny campaigns don't page anyone: the absolute change
// must also matter, not just be statistically unusual.
const MIN_DELTA: Record<NewAnomaly['metric'], number> = {
  spend: 5, // currency units
  clicks: 20,
  conversions: 3,
};

const METRICS: Array<{
  metric: NewAnomaly['metric'];
  actual: 'spend' | 'clicks' | 'conversions';
  avg: 'avg_spend' | 'avg_clicks' | 'avg_conversions';
  std: 'std_spend' | 'std_clicks' | 'std_conversions';
}> = [
  { metric: 'spend', actual: 'spend', avg: 'avg_spend', std: 'std_spend' },
  { metric: 'clicks', actual: 'clicks', avg: 'avg_clicks', std: 'std_clicks' },
  { metric: 'conversions', actual: 'conversions', avg: 'avg_conversions', std: 'std_conversions' },
];

const MAX_NARRATED_PER_RUN = 12;

function toDateStr(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function detectForSource(source: AnomalySource, from: string, to: string): Promise<NewAnomaly[]> {
  const candidates = await getAnomalyCandidates(source, from, to);
  const found: NewAnomaly[] = [];

  for (const row of candidates) {
    for (const m of METRICS) {
      const actual = row[m.actual];
      const mean = row[m.avg];
      const std = row[m.std];
      if (mean == null || std == null || std <= 0) continue;

      const z = (actual - mean) / std;
      if (Math.abs(z) < Z_MEDIUM) continue;
      if (Math.abs(actual - mean) < MIN_DELTA[m.metric]) continue;

      found.push({
        source,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        metric: m.metric,
        metricDate: toDateStr(row.metric_date),
        actualValue: Math.round(actual * 10000) / 10000,
        expectedValue: Math.round(mean * 10000) / 10000,
        zScore: Math.round(z * 1000) / 1000,
        direction: z > 0 ? 'spike' : 'drop',
        severity: Math.abs(z) >= Z_HIGH ? 'high' : 'medium',
      });
    }
  }
  return found;
}

/** One batched call: short, factual narratives for the new anomalies. */
async function narrateAnomalies(anomalies: Array<NewAnomaly & { id: number }>): Promise<void> {
  const list = anomalies
    .map(
      (a, i) =>
        `${i}. [${a.source === 'google_ads' ? 'Google Ads' : 'Meta Ads'}] "${a.campaignName}" — ${a.metric} ` +
        `${a.direction} on ${a.metricDate}: actual ${a.actualValue} vs ~${a.expectedValue} typical ` +
        `(z=${a.zScore}, severity ${a.severity})`,
    )
    .join('\n');

  const system =
    'You are a marketing analyst writing one-sentence alerts for detected metric anomalies. ' +
    'For each numbered anomaly, write ONE plain-English sentence: what changed, roughly by how much, and one ' +
    'plausible next step to check (be practical: budget change, tracking issue, creative fatigue, seasonality, auction shift). ' +
    'Use ONLY the numbers given; money is GBP. Respond with a JSON object: {"narratives": [{"index": number, "text": string}]}.';

  const result = await runAi(
    'anomaly_watch',
    { system, messages: [{ role: 'user', content: list }], json: true, maxTokens: 600 },
    { count: anomalies.length },
  );

  let parsed: { narratives?: Array<{ index?: number; text?: string }> } = {};
  try {
    parsed = JSON.parse(result.text) as typeof parsed;
  } catch {
    logger.warn('Anomaly narration returned unparseable JSON — anomalies stored without narratives');
    return;
  }

  for (const n of parsed.narratives ?? []) {
    if (typeof n.index !== 'number' || typeof n.text !== 'string' || !n.text.trim()) continue;
    const target = anomalies[n.index];
    if (!target) continue;
    await setAnomalyNarrative(target.id, n.text.trim().slice(0, 1000));
  }
}

/**
 * Scheduler entry point: scan the last `lookbackDays` for new anomalies across
 * both ad channels, store them, and narrate the new ones with one AI call.
 */
export async function runAnomalyWatch(lookbackDays: number): Promise<{ found: number; narrated: number }> {
  const to = new Date().toISOString().slice(0, 10);
  const from = shiftDays(to, -Math.max(1, lookbackDays));

  const [google, meta] = await Promise.all([
    detectForSource('google_ads', from, to).catch((err) => {
      logger.error('Anomaly detection failed for google_ads', { error: toErrorMessage(err) });
      return [] as NewAnomaly[];
    }),
    detectForSource('meta_ads', from, to).catch((err) => {
      logger.error('Anomaly detection failed for meta_ads', { error: toErrorMessage(err) });
      return [] as NewAnomaly[];
    }),
  ]);

  const all = [...google, ...meta];
  if (all.length === 0) {
    logger.info('Anomaly watch: no anomalies detected', { from, to });
    return { found: 0, narrated: 0 };
  }

  const ids = await insertAnomalies(all);
  const fresh = all
    .map((a, i) => ({ ...a, id: ids[i] }))
    .filter((a): a is NewAnomaly & { id: number } => a.id != null);

  logger.info('Anomaly watch: detection complete', {
    from,
    to,
    candidates: all.length,
    newlyStored: fresh.length,
  });

  const toNarrate = fresh
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, MAX_NARRATED_PER_RUN);
  if (toNarrate.length > 0) {
    await narrateAnomalies(toNarrate).catch((err) =>
      logger.error('Anomaly narration failed', { error: toErrorMessage(err) }),
    );
  }

  return { found: fresh.length, narrated: toNarrate.length };
}

function mapAnomalyRow(r: Awaited<ReturnType<typeof listRecentAnomalies>>[number]): AnomalyDTO {
  return {
    id: r.id,
    source: r.source,
    campaignName: r.campaign_name,
    metric: r.metric,
    metricDate: toDateStr(r.metric_date),
    actualValue: Number(r.actual_value),
    expectedValue: Number(r.expected_value),
    zScore: Number(r.z_score),
    direction: r.direction,
    severity: r.severity,
    narrative: r.narrative,
  };
}

/** Google-only anomalies limited to a client's own campaigns. */
export async function getRecentAnomaliesForCampaigns(
  campaignIds: number[],
  days = 14,
): Promise<AnomalyDTO[]> {
  const rows = await listRecentAnomaliesForCampaigns(days, campaignIds, 'google_ads');
  return rows.map(mapAnomalyRow);
}

/** Anomalies limited to a client's own campaigns, across BOTH channels. */
export async function getRecentAnomaliesForClient(
  googleCampaignIds: number[],
  metaCampaignIds: number[],
  days = 14,
): Promise<AnomalyDTO[]> {
  const [googleRows, metaRows] = await Promise.all([
    listRecentAnomaliesForCampaigns(days, googleCampaignIds, 'google_ads'),
    listRecentAnomaliesForCampaigns(days, metaCampaignIds, 'meta_ads'),
  ]);
  return [...googleRows, ...metaRows]
    .map(mapAnomalyRow)
    .sort((a, b) => b.metricDate.localeCompare(a.metricDate))
    .slice(0, 20);
}

export async function getRecentAnomalies(days = 14): Promise<AnomalyDTO[]> {
  const rows = await listRecentAnomalies(days);
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    campaignName: r.campaign_name,
    metric: r.metric,
    metricDate: toDateStr(r.metric_date),
    actualValue: Number(r.actual_value),
    expectedValue: Number(r.expected_value),
    zScore: Number(r.z_score),
    direction: r.direction,
    severity: r.severity,
    narrative: r.narrative,
  }));
}
