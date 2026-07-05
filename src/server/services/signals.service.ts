import { getCampaignAggregates } from '../db/repositories/metrics.repo';
import { getMetaCampaignAggregates } from '../db/repositories/meta-metrics.repo';
import { getGoogleAdsCurrency } from '../db/repositories/platformAccounts.repo';
import { isAiConfigured } from '../config/env';
import { runAi } from '../../ai/run';
import { logger, toErrorMessage } from '../logger';
import { previousRange } from '../../lib/date';
import { formatCurrency, formatNumber } from '../../lib/format';
import type { CampaignDTO, Signal, SignalsDTO } from '../../lib/types';

// Meta campaign ids are offset so they never collide with Google ids inside
// signal keys; the "(Meta)" name suffix tells the reader which channel it is.
// Exported so callers that filter signals by a client's campaign ids (e.g.
// scoped AI reports) can build a matching allowlist for Meta-sourced signals.
export const META_SIGNAL_ID_OFFSET = 1_000_000;
const META_ID_OFFSET = META_SIGNAL_ID_OFFSET;

async function getMetaAggregatesAsCampaigns(from: string, to: string): Promise<CampaignDTO[]> {
  const rows = await getMetaCampaignAggregates(from, to).catch(() => []);
  return rows.map((r) => {
    const spend = Number(r.spend);
    const impressions = Number(r.impressions);
    const clicks = Number(r.clicks);
    const conversions = Number(r.conversions);
    return {
      id: META_ID_OFFSET + r.id,
      googleCampaignId: r.meta_campaign_id,
      googleCustomerId: '',
      name: `${r.campaign_name ?? r.meta_campaign_id} (Meta)`,
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

const MIN_SPEND = 10; // ignore tiny campaigns
const MOVER_PCT = 40; // % change vs previous period to flag
const HIGH_CPA_MULTIPLE = 2; // x the account-average cost/conversion

const SEVERITY_ORDER: Record<Signal['severity'], number> = { warning: 0, info: 1, positive: 2 };

/**
 * Rule-based fallback signals (fixed thresholds). Kept ONLY as a safety net
 * for when AI is unconfigured or errors — everything normally goes through
 * getSmartSignals() below, where an AI analyst decides what matters and why.
 */
export async function getSignals(from: string, to: string): Promise<SignalsDTO> {
  const prev = previousRange(from, to);
  const [currency, googleCurrent, googlePrevious, metaCurrent, metaPrevious] = await Promise.all([
    getGoogleAdsCurrency().then((c) => c ?? 'GBP'),
    getCampaignAggregates({ from, to }),
    getCampaignAggregates({ from: prev.from, to: prev.to }),
    getMetaAggregatesAsCampaigns(from, to),
    getMetaAggregatesAsCampaigns(prev.from, prev.to),
  ]);
  const current = [...googleCurrent, ...metaCurrent];
  const previousCampaigns = [...googlePrevious, ...metaPrevious];

  const money = (n: number | null) => formatCurrency(n, currency);
  const prevById = new Map<number, CampaignDTO>(previousCampaigns.map((c) => [c.id, c]));
  const withSpend = current.filter((c) => c.spend >= MIN_SPEND);
  const signals: Signal[] = [];

  // Wasted spend — spending with zero conversions.
  for (const c of withSpend) {
    if (c.conversions === 0) {
      signals.push({
        id: `wasted-${c.id}`,
        kind: 'wasted_spend',
        severity: 'warning',
        title: `Wasted spend: ${c.name}`,
        detail: `${money(c.spend)} spent with 0 conversions in this period.`,
        action: 'Review targeting/creative or pause this campaign.',
        campaignId: c.id,
        campaignName: c.name,
      });
    }
  }

  // High cost per conversion vs the account average.
  const converting = current.filter((c) => c.conversions > 0 && c.costPerConversion != null);
  const avgCpa =
    converting.length > 0
      ? converting.reduce((s, c) => s + (c.costPerConversion as number), 0) / converting.length
      : 0;
  for (const c of converting) {
    const cpa = c.costPerConversion as number;
    if (avgCpa > 0 && cpa >= avgCpa * HIGH_CPA_MULTIPLE && c.spend >= MIN_SPEND) {
      signals.push({
        id: `cpa-${c.id}`,
        kind: 'high_cpa',
        severity: 'warning',
        title: `High cost per conversion: ${c.name}`,
        detail: `${money(cpa)} per conversion — well above the ${money(avgCpa)} account average.`,
        action: 'Check whether the conversion value justifies the cost.',
        campaignId: c.id,
        campaignName: c.name,
      });
    }
  }

  // Big spend movers vs the previous equal-length period.
  for (const c of withSpend) {
    const p = prevById.get(c.id);
    if (p && p.spend > 0) {
      const change = ((c.spend - p.spend) / p.spend) * 100;
      if (Math.abs(change) >= MOVER_PCT) {
        const up = change > 0;
        signals.push({
          id: `mover-${c.id}`,
          kind: up ? 'spend_up' : 'spend_down',
          severity: 'info',
          title: `Spend ${up ? 'up' : 'down'} ${Math.abs(Math.round(change))}%: ${c.name}`,
          detail: `${money(c.spend)} vs ${money(p.spend)} in the previous period.`,
          campaignId: c.id,
          campaignName: c.name,
        });
      }
    }
  }

  // A positive highlight: the best converter.
  if (converting.length > 0) {
    const best = converting.reduce((a, b) => (b.conversions > a.conversions ? b : a));
    signals.push({
      id: `top-${best.id}`,
      kind: 'top_performer',
      severity: 'positive',
      title: `Top performer: ${best.name}`,
      detail: `${formatNumber(best.conversions)} conversions${best.costPerConversion != null ? ` at ${money(best.costPerConversion)} each` : ''}.`,
      campaignId: best.id,
      campaignName: best.name,
    });
  }

  signals.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { dateRange: { from, to }, currency, signals: signals.slice(0, 10) };
}

// ── AI-powered signals (the normal path) ─────────────────────────────────────

// One AI analysis per range every 3 hours — refreshing the dashboard shouldn't
// re-analyse identical data.
const SIGNALS_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const signalsCache = new Map<string, { data: SignalsDTO; expiresAt: number }>();

/** Compact per-campaign line for the analyst prompt, with prev-period deltas. */
function campaignLine(c: CampaignDTO, prev: CampaignDTO | undefined, money: (n: number | null) => string): string {
  const channel = c.channelType === 'META' ? 'Meta' : 'Google';
  const base =
    `"${c.name}" [${channel}, ${c.status ?? '?'}]: spend ${money(c.spend)}, impressions ${c.impressions}, ` +
    `clicks ${c.clicks}, CTR ${c.ctr.toFixed(2)}%, conversions ${c.conversions}, ` +
    `cost/conv ${c.costPerConversion != null ? money(c.costPerConversion) : 'n/a'}`;
  if (!prev || (prev.spend === 0 && prev.conversions === 0)) return base;
  return `${base} | previous period: spend ${money(prev.spend)}, conversions ${prev.conversions}`;
}

/**
 * "What needs attention" decided by an AI analyst over the real per-campaign
 * numbers (both channels, with previous-period comparison) — no fixed
 * thresholds. Falls back to the rule engine when AI is unavailable so the
 * dashboard never goes blank. Powers the Needs-attention cards, AI reports,
 * the weekly digest and Canva report payloads.
 */
export async function getSmartSignals(from: string, to: string): Promise<SignalsDTO> {
  if (!isAiConfigured()) return getSignals(from, to);

  const cacheKey = `${from}:${to}`;
  const hit = signalsCache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) return hit.data;

  try {
    const prev = previousRange(from, to);
    const [currency, googleCurrent, googlePrevious, metaCurrent, metaPrevious] = await Promise.all([
      getGoogleAdsCurrency().then((c) => c ?? 'GBP'),
      getCampaignAggregates({ from, to }),
      getCampaignAggregates({ from: prev.from, to: prev.to }),
      getMetaAggregatesAsCampaigns(from, to),
      getMetaAggregatesAsCampaigns(prev.from, prev.to),
    ]);
    const current = [...googleCurrent, ...metaCurrent].filter((c) => c.spend > 0 || c.conversions > 0);
    if (current.length === 0) {
      return { dateRange: { from, to }, currency, signals: [] };
    }
    const prevById = new Map<number, CampaignDTO>(
      [...googlePrevious, ...metaPrevious].map((c) => [c.id, c]),
    );
    const money = (n: number | null) => formatCurrency(n, currency);

    // Token control: the analyst sees the top campaigns by spend, not hundreds.
    const lines = [...current]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 25)
      .map((c) => ` - ${campaignLine(c, prevById.get(c.id), money)}`)
      .join('\n');

    const system =
      'You are a sharp senior media analyst at ICE Creates reviewing cross-channel ad performance ' +
      '(Google Ads and Meta Ads). From the per-campaign data, pick the 3-7 things that genuinely matter — ' +
      'judged by financial impact and actionability, not by fixed thresholds. Think like an analyst: is spend ' +
      'producing results, which direction is each campaign moving vs the previous period, are the two channels ' +
      'pulling their weight relative to each other, and what single action follows from each finding? ' +
      'Skip trivia; if the whole account is healthy, say fewer things, not filler. Use ONLY the numbers given ' +
      'and cite them. Name the channel when it matters. Respond with a JSON object: ' +
      '{"signals": [{"severity": "warning"|"info"|"positive", "title": string (short, punchy), ' +
      '"detail": string (1-2 sentences citing the numbers and WHY it matters), ' +
      '"action": string (one concrete next step, or empty string for positives), ' +
      '"campaignName": string (the campaign it concerns, or empty string for account-wide points)}]} ' +
      'ordered most-important first, warnings before positives.';

    const user = `Period ${from} to ${to} (previous equal-length period shown for comparison). Currency ${currency}.\nCampaigns:\n${lines}`;

    const result = await runAi(
      'signals',
      { system, messages: [{ role: 'user', content: user }], json: true, maxTokens: 800 },
      { from, to, campaigns: current.length },
    );

    const parsed = JSON.parse(result.text) as {
      signals?: Array<{ severity?: string; title?: string; detail?: string; action?: string; campaignName?: string }>;
    };
    const nameToId = new Map(current.map((c) => [c.name.toLowerCase(), c.id]));
    const signals: Signal[] = (parsed.signals ?? [])
      .filter((s) => typeof s.title === 'string' && s.title.trim() && typeof s.detail === 'string')
      .slice(0, 8)
      .map((s, i) => {
        const campaignName = typeof s.campaignName === 'string' && s.campaignName.trim() ? s.campaignName.trim() : null;
        const severity: Signal['severity'] =
          s.severity === 'warning' || s.severity === 'positive' ? s.severity : 'info';
        return {
          id: `ai-${i}`,
          kind: 'ai',
          severity,
          title: String(s.title).slice(0, 200),
          detail: String(s.detail).slice(0, 500),
          action: typeof s.action === 'string' && s.action.trim() ? s.action.trim().slice(0, 300) : undefined,
          campaignId: campaignName ? nameToId.get(campaignName.toLowerCase()) ?? undefined : undefined,
          campaignName: campaignName ?? undefined,
        };
      });

    const data: SignalsDTO = { dateRange: { from, to }, currency, signals };
    if (signals.length > 0) {
      signalsCache.set(cacheKey, { data, expiresAt: Date.now() + SIGNALS_CACHE_TTL_MS });
    }
    return data;
  } catch (err) {
    logger.error('AI signals failed — falling back to rule engine', { error: toErrorMessage(err) });
    return getSignals(from, to);
  }
}
