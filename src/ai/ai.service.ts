import { getCampaignDetail, getDashboardOverview } from '../server/services/dashboard.service';
import { getSmartSignals, META_SIGNAL_ID_OFFSET } from '../server/services/signals.service';
import { getGoogleAdsAccountName } from '../server/db/repositories/platformAccounts.repo';
import { logger } from '../server/logger';
import { runAi, type RunAiResult } from './run';
import type { AiMessage } from './provider';
import { getAiConfig } from '../server/config/env';
import { guardSql } from './sql-guard';
import { runReadOnlyQuery, type AdhocResult } from '../server/db/repositories/adhocQuery.repo';
import { ANSWER_SYSTEM, MAX_ROWS_TO_MODEL, SQL_GEN_SYSTEM } from './sql-schema';
import type {
  AdCopyRequest,
  AdCopyResult,
  AdCopyVariant,
  AiAskResult,
  AiCampaignAnalysis,
  AiChartSpec,
  AiDisplaySpec,
  AiInsightsResult,
  AiReportDTO,
  AiTokenUsage,
  DashboardOverviewDTO,
} from '../lib/types';

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function usageOf(r: RunAiResult): AiTokenUsage {
  return {
    promptTokens: r.usage.promptTokens,
    completionTokens: r.usage.completionTokens,
    totalTokens: r.usage.totalTokens,
    estimatedCostUsd: round6(r.estimatedCostUsd),
  };
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asStringArray(v: unknown, max = 6): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [];
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/** Compact, token-economical context: totals + top campaigns only (no raw rows). */
function formatOverviewContext(o: DashboardOverviewDTO): string {
  const t = o.summary;
  const p = o.previous;
  const g = o.channels?.google;
  const m = o.channels?.meta;
  const lines = [
    `Date range: ${o.dateRange.from} to ${o.dateRange.to}. Currency: ${o.currency}.`,
    `Totals (all channels) — spend ${t.spend}, impressions ${t.impressions}, clicks ${t.clicks}, ` +
      `CTR ${t.ctr}%, conversions ${t.conversions}, ` +
      `cost/conversion ${t.costPerConversion ?? 'n/a'}, avg CPC ${t.averageCpc ?? 'n/a'}.`,
    p
      ? `Previous equal-length period — spend ${p.spend}, impressions ${p.impressions}, clicks ${p.clicks}, ` +
        `CTR ${p.ctr}%, conversions ${p.conversions}, cost/conversion ${p.costPerConversion ?? 'n/a'}.`
      : '',
    g && m
      ? `Channel split — Google Ads: spend ${g.spend}, clicks ${g.clicks}, conversions ${g.conversions}; ` +
        `Meta Ads: spend ${m.spend}, clicks ${m.clicks}, conversions ${m.conversions}.`
      : '',
    'Top campaigns (channelType META = Meta Ads, otherwise Google Ads):',
    ...o.topCampaigns.map(
      (c, i) =>
        ` ${i + 1}. ${c.name} [${c.status ?? '?'}, ${c.channelType ?? '?'}] — ` +
        `spend ${c.spend}, clicks ${c.clicks}, CTR ${c.ctr}%, conversions ${c.conversions}`,
    ),
  ].filter(Boolean);
  return lines.join('\n');
}

export async function generateInsights(from: string, to: string): Promise<AiInsightsResult> {
  const overview = await getDashboardOverview(from, to);
  const system =
    'You are a sharp senior media analyst at ICE Creates reviewing cross-channel advertising performance ' +
    '(Google Ads and Meta Ads). Analyse like a strategist, not a reporter: what direction is performance moving ' +
    'vs the previous period, where is the money working hardest, which channel is pulling its weight, and what ' +
    'would you change first? Name the channel when a point is channel-specific and always cite the figures. ' +
    'Use ONLY the data provided (currency as given) — never invent numbers. Respond with a JSON object: ' +
    '{"summary": string (2-3 sentences with a clear verdict, not just a restatement of the numbers), ' +
    '"recommendations": string[] (2-4 specific, prioritised actions — each says WHAT to do and WHY, grounded in the data)}.';
  const result = await runAi(
    'insights',
    { system, messages: [{ role: 'user', content: formatOverviewContext(overview) }], json: true },
    { from, to },
  );
  const obj = parseJsonObject(result.text);
  return {
    summary: asString(obj.summary, 'No summary was returned.'),
    recommendations: asStringArray(obj.recommendations, 4),
    model: result.model,
    usage: usageOf(result),
  };
}

function isNumericCol(rows: Array<Record<string, unknown>>, col: string): boolean {
  return (
    rows.length > 0 &&
    rows.every((r) => r[col] != null && (typeof r[col] === 'number' || !Number.isNaN(Number(r[col]))))
  );
}

const CHART_TYPES = new Set(['line', 'bar', 'hbar', 'pie']);

/** Longest string length in a column — used to decide vertical vs horizontal bars. */
function maxLabelLength(rows: Array<Record<string, unknown>>, col: string): number {
  return rows.reduce((m, r) => Math.max(m, String(r[col] ?? '').length), 0);
}

/** Validate an explicit chart spec proposed by the model (incl. optional series). */
function explicitChartSpec(obj: Record<string, unknown>, columns: string[]): AiChartSpec | null {
  const d = obj.display;
  if (!d || typeof d !== 'object' || (d as { kind?: unknown }).kind !== 'chart') return null;
  const chart = (d as { chart?: unknown }).chart;
  if (!chart || typeof chart !== 'object') return null;
  const c = chart as { type?: unknown; x?: unknown; y?: unknown; series?: unknown };
  const type = typeof c.type === 'string' && CHART_TYPES.has(c.type) ? (c.type as AiChartSpec['type']) : null;
  const x = typeof c.x === 'string' ? c.x : '';
  let y = Array.isArray(c.y) ? c.y.filter((s): s is string => typeof s === 'string') : [];
  if (type === 'pie' || type === 'hbar') y = y.slice(0, 1);
  if (!type || !columns.includes(x) || y.length === 0 || !y.every((col) => columns.includes(col))) return null;
  const series = typeof c.series === 'string' && c.series !== x && columns.includes(c.series) ? c.series : undefined;
  return series ? { type, x, y, series } : { type, x, y };
}

/**
 * Decide how to present the result — adaptively, by data shape, always giving a
 * useful view when rows exist (never a dead-end):
 *  - one entity, several metrics → metric cards ("stats");
 *  - a metric split by category over time → multi-series line (one line/colour
 *    per category);
 *  - several mixed-scale metrics over time → small multiples (one mini chart each);
 *  - one metric over time → line; category comparison → horizontal/vertical bars;
 *    share of a total → donut (when the model asks).
 * A valid explicit chart from the model is respected first.
 */
function parseDisplay(
  obj: Record<string, unknown>,
  columns: string[],
  rows: Array<Record<string, unknown>>,
): AiDisplaySpec {
  if (rows.length === 0) return { kind: 'text' };

  const numericCols = columns.filter((col) => isNumericCol(rows, col));

  // Single entity → metric cards (charting one row is never useful).
  if (rows.length === 1) {
    return numericCols.length >= 2 ? { kind: 'stats' } : { kind: 'text' };
  }

  // Respect a valid explicit chart from the model.
  const explicit = explicitChartSpec(obj, columns);
  if (explicit) return { kind: 'chart', chart: explicit };

  const dateCol = columns.find((col) => /date|day|month|week/i.test(col));
  const catCol = columns.find(
    (col) => col !== dateCol && !numericCols.includes(col) && rows.some((r) => typeof r[col] === 'string'),
  );

  // Time series.
  if (dateCol) {
    const metricCols = numericCols.filter((col) => col !== dateCol);
    // a) a metric split by category over time → one coloured line per category.
    if (catCol && metricCols.length >= 1) {
      const distinct = new Set(rows.map((r) => String(r[catCol]))).size;
      if (distinct >= 2) {
        return { kind: 'chart', chart: { type: 'line', x: dateCol, y: [metricCols[0]], series: catCol } };
      }
    }
    // b) several different-scale metrics over time → small multiples.
    if (metricCols.length >= 2) return { kind: 'multiples' };
    // c) one metric over time → single line.
    if (metricCols.length === 1) return { kind: 'chart', chart: { type: 'line', x: dateCol, y: [metricCols[0]] } };
  }

  // Category comparison → horizontal/vertical bars (hbar keeps long names readable).
  if (catCol && numericCols.length > 0) {
    const horizontal = rows.length > 6 || maxLabelLength(rows, catCol) > 14;
    return { kind: 'chart', chart: { type: horizontal ? 'hbar' : 'bar', x: catCol, y: [numericCols[0]] } };
  }

  return { kind: 'text' };
}

function emptyUsage(): AiTokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
}

function addUsage(acc: AiTokenUsage, r: RunAiResult): void {
  acc.promptTokens += r.usage.promptTokens;
  acc.completionTokens += r.usage.completionTokens;
  acc.totalTokens += r.usage.totalTokens;
  acc.estimatedCostUsd = round6(acc.estimatedCostUsd + r.estimatedCostUsd);
}

/**
 * Schema-aware text-to-SQL agent. Generates a read-only SELECT, guards it,
 * executes it (rolled-back), then answers from the ACTUAL rows — so the numbers
 * come from the database, not the model. Self-corrects on guard/SQL errors or
 * when the rows don't answer the question, bounded by AI_SQL_MAX_ATTEMPTS.
 */
export async function askAi(
  question: string,
  from: string,
  to: string,
  history: AiMessage[],
  /** Client-role scoping: Google Ads campaign ids this user may see. Undefined = staff (unrestricted). */
  allowedCampaignIds?: number[],
  /** Client-role scoping: Meta Ads campaign ids this user may see (a SEPARATE id space from Google's). */
  allowedMetaCampaignIds?: number[],
): Promise<AiAskResult> {
  const maxAttempts = Math.max(1, getAiConfig().maxSqlAttempts);
  const usage = emptyUsage();
  let model = '';
  let lastSql = '';
  let lastError = '';
  let feedback = '';
  // Best non-empty result seen so far, so we never dead-end when data exists.
  let best: { answerText: string; obj: Record<string, unknown>; result: AdhocResult; sql: string } | null = null;
  // A valid query that ran but found nothing — "no rows" is itself an honest answer.
  let emptyRunSql = '';

  const priorContext = history.map((m) => `${m.role}: ${m.content}`).join('\n');

  // Client scope constraint injected into every SQL generation prompt.
  // Google and Meta campaign ids are UNRELATED integer spaces (e.g. Google id 5
  // and Meta id 5 are different campaigns) — each channel's rows must be
  // filtered by its OWN id list, never the other's, and a channel the client
  // has zero campaigns in must be excluded entirely rather than left unfiltered.
  const isClientScoped = allowedCampaignIds !== undefined || allowedMetaCampaignIds !== undefined;
  let campaignFilter = '';
  if (isClientScoped) {
    const googleIds = allowedCampaignIds ?? [];
    const metaIds = allowedMetaCampaignIds ?? [];
    const rules: string[] = [];
    rules.push(
      googleIds.length > 0
        ? `Google Ads: every query touching google_ads_campaigns/google_ads_campaign_daily_metrics MUST include "AND c.id IN (${googleIds.join(', ')})".`
        : 'Google Ads: this user has NO Google Ads campaigns assigned — NEVER query google_ads_campaigns or google_ads_campaign_daily_metrics for them.',
    );
    rules.push(
      metaIds.length > 0
        ? `Meta Ads: every query touching meta_ads_campaigns/meta_ads_campaign_daily_metrics MUST include "AND c.id IN (${metaIds.join(', ')})".`
        : 'Meta Ads: this user has NO Meta Ads campaigns assigned — NEVER query meta_ads_campaigns or meta_ads_campaign_daily_metrics for them.',
    );
    campaignFilter =
      `\n\nSECURITY CONSTRAINT (mandatory, applies to EVERY SELECT — including each side of a UNION ALL): ` +
      `this user is a client scoped to specific campaigns only, and Google/Meta ids do NOT correspond to the ` +
      `same campaigns even when numerically equal — never cross-apply one channel's id list to the other's table.\n` +
      rules.join('\n');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 1) Generate SQL (schema in the system message; only step that sees it).
    const todayStr = new Date().toISOString().slice(0, 10);
    const genUser =
      `${priorContext ? `Recent conversation:\n${priorContext}\n\n` : ''}` +
      `Today's date: ${todayStr}.\n` +
      `The dashboard is currently showing ${from} to ${to} — ONLY use this as the metric_date filter if the ` +
      `question explicitly references "this period"/"currently"/"on screen" or similar; a bare question with ` +
      `no time wording means ALL TIME (no date filter). For any other relative period ("last 7 days" etc.), ` +
      `compute it yourself from today's date above.\n` +
      `Question: ${question}` +
      campaignFilter +
      (feedback ? `\n\nYour previous attempt failed — fix it. ${feedback}` : '');
    const gen = await runAi(
      'ask_sql',
      { system: SQL_GEN_SYSTEM, messages: [{ role: 'user', content: genUser }], json: true, maxTokens: 350 },
      { from, to },
    );
    model = gen.model;
    addUsage(usage, gen);

    const genObj = parseJsonObject(gen.text);
    const intent = asString(genObj.intent).toLowerCase();
    const textOnly = (answer: string) => ({
      answer,
      sql: '',
      columns: [],
      rows: [],
      truncated: false,
      display: { kind: 'text' } as AiDisplaySpec,
      model,
      usage,
    });

    // Social: greetings, thanks, compliments — reply warmly, like a friend.
    if (intent === 'social') {
      logger.info('Assistant social reply', { question: question.slice(0, 200) });
      return textOnly(
        asString(genObj.reply).trim() ||
          "Thank you — really glad that was helpful! 😊 I'm here whenever you want to dig into more of your campaigns.",
      );
    }
    // Off-topic: friendly but firm — don't answer things unrelated to the data,
    // and never let the model answer from general knowledge.
    if (intent === 'offtopic') {
      logger.info('Assistant refused off-topic question', { question: question.slice(0, 200) });
      return textOnly(
        "That one's a little outside my lane — I'm your advertising data assistant (Google Ads and Meta Ads), so I'm best with spend, clicks, conversions, CTR or how your campaigns are doing. What would you like to explore? 😊",
      );
    }
    // Clarify: on-topic but genuinely ambiguous — ask a short question.
    if (intent === 'clarify') {
      logger.info('Assistant asked for clarification', { question: question.slice(0, 200) });
      return textOnly(
        asString(genObj.clarify).trim() ||
          'Which campaign or metric would you like? e.g. "spend for StopFroLife App Promotion".',
      );
    }
    // Format: re-present the previous answer in words — no new data needed.
    if (intent === 'format') {
      const lastAnswer = [...history].reverse().find((m) => m.role === 'assistant')?.content;
      logger.info('Assistant re-explained previous answer in text', { question: question.slice(0, 200) });
      return textOnly(lastAnswer || 'Here it is in words — see the previous answer above.');
    }
    // Explain: a glossary/definition question about a metric or term — never echo the previous answer.
    if (intent === 'explain') {
      logger.info('Assistant explained a metric/term', { question: question.slice(0, 200) });
      return textOnly(
        asString(genObj.reply).trim() ||
          "Happy to explain — could you tell me which metric or term you'd like me to break down?",
      );
    }

    const sql = asString(genObj.sql).trim();
    if (!sql) {
      feedback = 'You did not return any SQL. Respond with {"intent":"data","sql":"<one SELECT>"}.';
      continue;
    }
    lastSql = sql;

    // 2) Guard.
    const guard = guardSql(sql);
    if (!guard.ok) {
      lastError = guard.error;
      feedback = `The SQL was rejected (${guard.error}). Return a single read-only SELECT over the allowed tables only.`;
      continue;
    }

    // 3) Execute read-only (always rolled back).
    let result: AdhocResult | null = null;
    try {
      result = await runReadOnlyQuery(guard.sql);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      feedback = `The SQL failed to run with this error: ${lastError}. Correct the query.`;
      lastSql = guard.sql;
      continue;
    }
    if (!result) continue;
    lastSql = guard.sql;
    logger.info('Assistant SQL executed', {
      question: question.slice(0, 200),
      rows: result.rowCount,
      sql: guard.sql,
    });

    // 4) Validate + answer from the actual rows (no schema sent here).
    const rowsForModel = result.rows.slice(0, MAX_ROWS_TO_MODEL);
    const answerUser =
      `Question: ${question}\n\n` +
      `SQL columns: ${JSON.stringify(result.columns)}\n` +
      `Rows (${result.rowCount}${result.truncated ? ', truncated' : ''}): ${JSON.stringify(rowsForModel)}`;
    const ans = await runAi(
      'ask_answer',
      { system: ANSWER_SYSTEM, messages: [{ role: 'user', content: answerUser }], json: true, maxTokens: 300 },
      { from, to },
    );
    model = ans.model;
    addUsage(usage, ans);

    const obj = parseJsonObject(ans.text);
    const answered = obj.answered === true;
    const answerText = asString(obj.answer);

    // Remember the first non-empty result as a best-effort fallback.
    if (result.rows.length > 0 && !best) {
      best = { answerText, obj, result, sql: guard.sql };
    }
    if (result.rows.length === 0 && !emptyRunSql) {
      emptyRunSql = guard.sql;
    }

    if (answered) {
      return {
        answer: answerText || 'Here is what I found.',
        sql: guard.sql,
        columns: result.columns,
        rows: result.rows,
        truncated: result.truncated,
        display: parseDisplay(obj, result.columns, result.rows),
        model,
        usage,
      };
    }

    if (attempt < maxAttempts) {
      feedback = `The previous query's results did not fully answer the question (${asString(obj.reason, 'insufficient data')}). Previous SQL: ${guard.sql}. Write a different query that answers it.`;
      continue;
    }
  }

  // The loop ended without a confident answer. If any attempt returned rows,
  // still show that data with a chart — we never dead-end when data exists.
  if (best) {
    return {
      answer:
        best.answerText ||
        'Here is the closest data I found — tell me if you want it sliced differently.',
      sql: best.sql,
      columns: best.result.columns,
      rows: best.result.rows,
      truncated: best.result.truncated,
      display: parseDisplay(best.obj, best.result.columns, best.result.rows),
      model,
      usage,
    };
  }

  // A valid query ran and genuinely found nothing — say so honestly instead of
  // implying the question was wrong (e.g. "Meta campaigns" before any Meta sync).
  if (emptyRunSql) {
    return {
      answer:
        "I checked the database and there's genuinely nothing there for that yet — the query ran fine but returned no rows. " +
        'That usually means the data hasn\'t synced yet (you can run a sync from the Sync Centre) or nothing matches that filter.',
      sql: emptyRunSql,
      columns: [],
      rows: [],
      truncated: false,
      display: { kind: 'text' },
      model,
      usage,
    };
  }

  return {
    answer:
      'I couldn’t find data for that. Try naming a campaign or a metric — e.g. "spend for StopFroLife App Promotion" or "clicks by campaign".' +
      (lastError ? ` (last error: ${lastError})` : ''),
    sql: lastSql,
    columns: [],
    rows: [],
    truncated: false,
    display: { kind: 'text' },
    model,
    usage,
  };
}

export async function analyzeCampaign(
  id: number,
  from: string,
  to: string,
): Promise<AiCampaignAnalysis | null> {
  const detail = await getCampaignDetail(id, from, to);
  if (!detail) return null;
  const c = detail.campaign;
  const context =
    `Campaign "${c.name}" [${c.status ?? '?'}, ${c.channelType ?? '?'}]. ` +
    `Range ${from} to ${to}. Currency ${detail.currency}. ` +
    `Spend ${c.spend}, impressions ${c.impressions}, clicks ${c.clicks}, CTR ${c.ctr}%, ` +
    `conversions ${c.conversions}, cost/conversion ${c.costPerConversion ?? 'n/a'}, ` +
    `avg CPC ${c.averageCpc ?? 'n/a'}. Days with data: ${detail.daily.length}.`;
  const system =
    'You are a marketing analyst. Given one Google Ads campaign\'s metrics, respond with a JSON object: ' +
    '{"summary": string (2 sentences), "strengths": string[] (1-3), "suggestion": string (1 actionable idea)}. ' +
    'Use ONLY the data provided.';
  const result = await runAi(
    'campaign',
    { system, messages: [{ role: 'user', content: context }], json: true },
    { id, from, to },
  );
  const obj = parseJsonObject(result.text);
  return {
    summary: asString(obj.summary),
    strengths: asStringArray(obj.strengths, 3),
    suggestion: asString(obj.suggestion),
    model: result.model,
    usage: usageOf(result),
  };
}

/**
 * Ad Copy Studio: platform-aware ad copy variants with hard character limits
 * (Google RSA: 30-char headlines / 90-char descriptions; Meta: 40-char
 * headline, 30-char description-equivalent link text, 125-char primary text).
 * Over-limit variants are trimmed at a word boundary server-side so the UI
 * never shows an invalid ad.
 */
export async function generateAdCopy(req: AdCopyRequest): Promise<AdCopyResult> {
  const isGoogle = req.platform === 'google';
  const count = Math.min(Math.max(req.variants ?? 5, 1), 8);

  const limits = isGoogle
    ? 'Google Ads Responsive Search Ad limits: headline MAX 30 characters, description MAX 90 characters.'
    : 'Meta (Facebook/Instagram) ad limits: headline MAX 40 characters, description MAX 30 characters, primaryText MAX 125 characters (the text above the creative — hook first, benefit second).';

  const brief = [
    `Product/service: ${req.product}`,
    req.audience ? `Target audience: ${req.audience}` : '',
    req.tone ? `Tone of voice: ${req.tone}` : 'Tone of voice: confident, warm, professional',
    req.keyPoints ? `Key points to include: ${req.keyPoints}` : '',
    req.newsHook ? `Newsjacking angle (tie the copy to this timely hook): ${req.newsHook}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const system =
    `You are a senior copywriter at ICE Creates, a behaviour-change creative agency. Write ${count} distinct ` +
    `${isGoogle ? 'Google Search ad' : 'Meta (Facebook/Instagram) ad'} copy variants. ${limits} ` +
    'Every variant must take a different angle (benefit-led, urgency, social proof, question, emotional). ' +
    'British English. No clickbait, no ALL CAPS, no fake claims — copy must be honest and specific to the brief. ' +
    `Respond with a JSON object: {"variants": [{"headline": string, "description": string${isGoogle ? '' : ', "primaryText": string'}}]}.`;

  const result = await runAi(
    'ad_copy',
    { system, messages: [{ role: 'user', content: brief }], json: true, maxTokens: 900 },
    { platform: req.platform, variants: count },
  );

  const obj = parseJsonObject(result.text);
  const raw = Array.isArray(obj.variants) ? obj.variants : [];
  const headlineMax = isGoogle ? 30 : 40;
  const descriptionMax = isGoogle ? 90 : 30;

  const trim = (s: unknown, max: number): string => {
    const text = typeof s === 'string' ? s.trim() : '';
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
  };

  const variants: AdCopyVariant[] = raw
    .filter((v): v is Record<string, unknown> => v != null && typeof v === 'object')
    .map((v) => ({
      headline: trim(v.headline, headlineMax),
      description: trim(v.description, descriptionMax),
      ...(isGoogle ? {} : { primaryText: trim(v.primaryText, 125) }),
    }))
    .filter((v) => v.headline && v.description)
    .slice(0, count);

  return { platform: req.platform, variants, model: result.model, usage: usageOf(result) };
}

export interface CampaignWindow {
  startDate: string;
  endDate: string;
  title: string;
  rationale: string;
}

export interface CampaignWindowsResult {
  month: string;
  windows: CampaignWindow[];
  model: string;
  usage: AiTokenUsage;
}

/**
 * AI-suggested launch windows for a month: combines the culturally relevant
 * dates from the marketing calendar with the account's own historical weekday
 * performance (which days actually convert), so "when should we launch?"
 * gets a grounded answer instead of a guess.
 */
export async function suggestCampaignWindows(
  month: string, // YYYY-MM
  calendarEvents: Array<{ date: string; event: string; category: string }>,
  weekdayPerformance: Array<{ weekday: string; avgClicks: number; avgConversions: number }>,
): Promise<CampaignWindowsResult> {
  const eventsList =
    calendarEvents.length > 0
      ? calendarEvents
          .slice(0, 15)
          .map((e) => ` - ${e.date}: ${e.event} [${e.category}]`)
          .join('\n')
      : ' - none known';

  const weekdayList =
    weekdayPerformance.length > 0
      ? weekdayPerformance
          .map((w) => ` - ${w.weekday}: avg ${w.avgClicks} clicks/day, ${w.avgConversions} conversions/day`)
          .join('\n')
      : ' - no historical data yet';

  const system =
    'You are a media planner at ICE Creates recommending WHEN to launch campaigns. Combine the cultural ' +
    'calendar with the account\'s own weekday performance history. ALWAYS suggest 2-4 launch windows inside ' +
    'the given month — each a contiguous date range of 3-10 days, dates strictly in YYYY-MM-DD format. ' +
    'Ground every rationale in the data given (name the event and/or the strong weekdays); do not invent events. ' +
    'When the calendar and history are empty, still suggest 2 windows from general UK campaign best practice ' +
    '(early-week launches, pay-day proximity, avoiding bank holidays) and say in the rationale that it is a ' +
    'general recommendation until more data arrives. Respond with a JSON object: ' +
    '{"windows": [{"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "title": string (short), ' +
    '"rationale": string (1-2 sentences)}]}.';

  const user =
    `Month to plan: ${month}.\n\nCulturally relevant dates this month:\n${eventsList}\n\n` +
    `Historical performance by weekday (last 90 days, all channels):\n${weekdayList}`;

  const result = await runAi(
    'campaign_windows',
    { system, messages: [{ role: 'user', content: user }], json: true, maxTokens: 600 },
    { month },
  );

  const obj = parseJsonObject(result.text);
  const raw = Array.isArray(obj.windows) ? obj.windows : [];
  const windows: CampaignWindow[] = raw
    .filter((w): w is Record<string, unknown> => w != null && typeof w === 'object')
    .map((w) => ({
      startDate: asString(w.startDate),
      endDate: asString(w.endDate),
      title: asString(w.title),
      rationale: asString(w.rationale),
    }))
    .filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(w.endDate) && w.title)
    .slice(0, 4);

  return { month, windows, model: result.model, usage: usageOf(result) };
}

export interface AiCampaignComparison {
  headline: string;
  summary: string;
  differences: string[];
  recommendation: string;
  model: string;
  usage: AiTokenUsage;
}

/**
 * Side-by-side AI comparison of two campaigns over the same period — which is
 * winning on what, why the numbers differ, and one action to take.
 */
export async function compareCampaigns(
  idA: number,
  idB: number,
  from: string,
  to: string,
): Promise<AiCampaignComparison | null> {
  const [a, b] = await Promise.all([
    getCampaignDetail(idA, from, to),
    getCampaignDetail(idB, from, to),
  ]);
  if (!a || !b) return null;

  const line = (d: NonNullable<typeof a>) => {
    const c = d.campaign;
    return (
      `"${c.name}" [${c.status ?? '?'}]: spend ${c.spend}, impressions ${c.impressions}, clicks ${c.clicks}, ` +
      `CTR ${c.ctr}%, conversions ${c.conversions}, cost/conversion ${c.costPerConversion ?? 'n/a'}, ` +
      `avg CPC ${c.averageCpc ?? 'n/a'}, days with data ${d.daily.length}`
    );
  };

  const context =
    `Period ${from} to ${to}. Currency ${a.currency}.\n` +
    `Campaign A — ${line(a)}\n` +
    `Campaign B — ${line(b)}`;

  const system =
    'You are a marketing analyst comparing two Google Ads campaigns for the agency ICE Creates. ' +
    'Use ONLY the numbers provided; cite them. Respond with a JSON object: ' +
    '{"headline": string (one line naming the stronger performer and on what), ' +
    '"summary": string (2-3 sentences comparing them honestly), ' +
    '"differences": string[] (2-4 short, specific contrasts with figures), ' +
    '"recommendation": string (ONE practical action, e.g. shift budget, copy learnings, pause)}.';

  const result = await runAi(
    'campaign_compare',
    { system, messages: [{ role: 'user', content: context }], json: true, maxTokens: 500 },
    { idA, idB, from, to },
  );

  const obj = parseJsonObject(result.text);
  return {
    headline: asString(obj.headline, 'Comparison ready'),
    summary: asString(obj.summary),
    differences: asStringArray(obj.differences, 4),
    recommendation: asString(obj.recommendation),
    model: result.model,
    usage: usageOf(result),
  };
}

export interface ClientNarrativeInput {
  clientName: string;
  from: string;
  to: string;
  currency: string;
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    costPerConversion: number | null;
  };
  previousTotals?: ClientNarrativeInput['totals'] | null;
  topCampaigns: Array<{ name: string; spend: number; clicks: number; conversions: number }>;
  pacing?: {
    monthlyBudget: number;
    spentThisMonth: number;
    projectedSpend: number;
    status: string;
  } | null;
}

export interface ClientNarrativeResult {
  narrative: string;
  whatToWatch: string[];
  model: string;
  usage: AiTokenUsage;
}

/**
 * Plain-English performance narrative FOR THE CLIENT — written for someone
 * with no marketing background. No jargon, no acronyms without explanation,
 * warm and honest. Grounded strictly in the scoped numbers provided.
 */
export async function generateClientNarrative(input: ClientNarrativeInput): Promise<ClientNarrativeResult> {
  const t = input.totals;
  const p = input.previousTotals;
  const lines = [
    `Client: ${input.clientName}. Period: ${input.from} to ${input.to}. Currency: ${input.currency}.`,
    `This period — spend ${t.spend}, ads shown (impressions) ${t.impressions}, clicks ${t.clicks}, ` +
      `click-through rate ${t.ctr}%, conversions ${t.conversions}, cost per conversion ${t.costPerConversion ?? 'n/a'}.`,
    p
      ? `Previous equal period — spend ${p.spend}, impressions ${p.impressions}, clicks ${p.clicks}, ` +
        `CTR ${p.ctr}%, conversions ${p.conversions}.`
      : '',
    input.topCampaigns.length > 0 ? 'Their campaigns:' : '',
    ...input.topCampaigns
      .slice(0, 5)
      .map((c) => ` - ${c.name}: spend ${c.spend}, clicks ${c.clicks}, conversions ${c.conversions}`),
    input.pacing
      ? `Monthly budget: ${input.pacing.monthlyBudget}. Spent so far this month: ${input.pacing.spentThisMonth}. ` +
        `Projected month-end spend at the current pace: ${input.pacing.projectedSpend} (status: ${input.pacing.status}).`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const system =
    'You write a short performance update for a CLIENT of ICE Creates who has NO marketing background. ' +
    'Plain, warm, honest English — no jargon (say "people who clicked your ad", not "CTR"; if you must use a term, ' +
    'explain it in brackets). Use ONLY the numbers provided; money is in the given currency. Never invent numbers. ' +
    'If results are poor, be honest but constructive. Respond with a JSON object: ' +
    '{"narrative": string (3-5 friendly sentences: what happened, what it means for them, and — if budget data is ' +
    'present — where their budget stands), "whatToWatch": string[] (1-3 short plain-English things worth keeping an eye on)}.';

  const result = await runAi(
    'client_narrative',
    { system, messages: [{ role: 'user', content: lines }], json: true, maxTokens: 450 },
    { clientName: input.clientName, from: input.from, to: input.to },
  );

  const obj = parseJsonObject(result.text);
  return {
    narrative: asString(obj.narrative, 'Your latest performance data is in — ask us anything about it.'),
    whatToWatch: asStringArray(obj.whatToWatch, 3),
    model: result.model,
    usage: usageOf(result),
  };
}

export interface ContentReviewResult {
  /** Overall verdict: ready | needs_edits */
  verdict: 'ready' | 'needs_edits';
  issues: Array<{ type: string; note: string }>;
  correctedTitle: string;
  correctedCaption: string;
  model: string;
  usage: AiTokenUsage;
}

/**
 * AI pre-review for approval submissions: spelling/grammar corrections, tone
 * and brand-safety notes. Grounded strictly in the submitted text — the
 * corrected copy must preserve meaning, only fixing errors and awkwardness.
 */
export async function reviewContent(title: string, caption: string): Promise<ContentReviewResult> {
  const system =
    'You are a senior editor at ICE Creates, a behaviour-change creative agency, pre-reviewing content ' +
    'before it goes to a human approver. British English. Check the title and caption for: spelling, grammar, ' +
    'punctuation, awkward phrasing, ALL-CAPS shouting, unsubstantiated claims, and anything off-brand for a ' +
    'professional public-sector-facing agency (offensive, insensitive, or clickbait wording). ' +
    'Return corrected versions that fix ONLY genuine problems — keep the author\'s voice and meaning; if the text ' +
    'is already fine, return it unchanged. Respond with a JSON object: ' +
    '{"verdict": "ready"|"needs_edits", "issues": [{"type": "spelling"|"grammar"|"tone"|"brand"|"claim", "note": string}], ' +
    '"correctedTitle": string, "correctedCaption": string}. verdict is "ready" when there are no issues.';

  const result = await runAi(
    'content_review',
    {
      system,
      messages: [{ role: 'user', content: `Title: ${title || '(none)'}\n\nCaption:\n${caption || '(none)'}` }],
      json: true,
      maxTokens: 600,
    },
    { titleLength: title.length, captionLength: caption.length },
  );

  const obj = parseJsonObject(result.text);
  const issuesRaw = Array.isArray(obj.issues) ? obj.issues : [];
  const issues = issuesRaw
    .filter((i): i is Record<string, unknown> => i != null && typeof i === 'object')
    .map((i) => ({ type: asString(i.type, 'note'), note: asString(i.note) }))
    .filter((i) => i.note)
    .slice(0, 8);

  return {
    verdict: obj.verdict === 'ready' && issues.length === 0 ? 'ready' : issues.length === 0 ? 'ready' : 'needs_edits',
    issues,
    correctedTitle: asString(obj.correctedTitle, title),
    correctedCaption: asString(obj.correctedCaption, caption),
    model: result.model,
    usage: usageOf(result),
  };
}

export interface ReportScope {
  /** Restrict the report to these Google Ads campaign IDs. */
  campaignIds?: number[];
  /** Restrict the report to these Meta Ads campaign IDs. */
  metaCampaignIds?: number[];
  /** Display name of the client the report is for (changes the framing). */
  clientName?: string | null;
}

/** Generates a concise, client-ready report grounded in aggregates + signals. */
export async function generateReport(from: string, to: string, scope?: ReportScope): Promise<AiReportDTO> {
  // IMPORTANT: pass arrays through as-given — an empty array means "zero
  // campaigns selected in this channel" (exclude it), which is different from
  // `undefined` ("no scoping requested" -> unscoped/global). Collapsing empty
  // arrays to undefined here would make a Meta-only selection accidentally
  // show ALL Google accounts' data instead of none.
  const campaignIds = scope?.campaignIds;
  const metaCampaignIds = scope?.metaCampaignIds;
  const isScoped = campaignIds !== undefined || metaCampaignIds !== undefined;
  const [overview, signalsDto, accountName] = await Promise.all([
    getDashboardOverview(from, to, campaignIds, 'all', metaCampaignIds),
    getSmartSignals(from, to),
    getGoogleAdsAccountName(),
  ]);

  // Scoped reports only mention signals about the selected campaigns (Google
  // ids as-is, Meta ids offset the same way getSignals() built them).
  if (isScoped) {
    const allowed = new Set([
      ...(campaignIds ?? []),
      ...(metaCampaignIds ?? []).map((id) => META_SIGNAL_ID_OFFSET + id),
    ]);
    signalsDto.signals = signalsDto.signals.filter(
      (s) => s.campaignId == null || allowed.has(s.campaignId),
    );
  }

  const subject = scope?.clientName
    ? `Client: ${scope.clientName} (their campaigns only)`
    : `Account: ${accountName ?? 'the advertising account'} (Google Ads + Meta Ads combined)`;
  const t = overview.summary;
  const g = overview.channels?.google;
  const m = overview.channels?.meta;
  const context = [
    `${subject}. Period: ${from} to ${to}. Currency: ${overview.currency}.`,
    g && m
      ? `Channel split — Google Ads: spend ${g.spend}, impressions ${g.impressions}, clicks ${g.clicks}, ` +
        `conversions ${g.conversions}; Meta Ads: spend ${m.spend}, impressions ${m.impressions}, ` +
        `clicks ${m.clicks}, conversions ${m.conversions}.`
      : '',
    `Totals — spend ${t.spend}, impressions ${t.impressions}, clicks ${t.clicks}, CTR ${t.ctr}%, ` +
      `conversions ${t.conversions}, cost/conversion ${t.costPerConversion ?? 'n/a'}, avg CPC ${t.averageCpc ?? 'n/a'}.`,
    'Top campaigns (channel marked META = Meta Ads, otherwise Google Ads):',
    ...overview.topCampaigns.map(
      (c, i) =>
        ` ${i + 1}. ${c.name} [${c.status ?? '?'}, ${c.channelType ?? '?'}] — spend ${c.spend}, clicks ${c.clicks}, CTR ${c.ctr}%, conversions ${c.conversions}`,
    ),
    'Flags:',
    ...(signalsDto.signals.length > 0
      ? signalsDto.signals.map((s) => ` - [${s.severity}] ${s.title}: ${s.detail}`)
      : [' - none']),
  ]
    .filter(Boolean)
    .join('\n');

  const system =
    'You write a concise, client-ready advertising performance report (Google Ads and Meta Ads) for the ' +
    'agency ICE Creates. When both channels have data, compare them where meaningful and name the channel ' +
    'in channel-specific points; when only one channel has data, report on that one without inventing the other. ' +
    'Use ONLY the data provided (currency as given) and cite specific figures. Respond with a JSON ' +
    'object: {"headline": string, "summary": string (2-3 sentences), "highlights": string[] (2-4), ' +
    '"concerns": string[] (0-3), "recommendations": string[] (2-4)}.';
  const result = await runAi(
    'report',
    { system, messages: [{ role: 'user', content: context }], json: true, maxTokens: 700 },
    { from, to, clientName: scope?.clientName ?? null },
  );
  const obj = parseJsonObject(result.text);
  return {
    account: scope?.clientName ?? accountName,
    dateRange: { from, to },
    currency: overview.currency,
    generatedAt: new Date().toISOString(),
    headline: asString(obj.headline, 'Performance report'),
    summary: asString(obj.summary),
    highlights: asStringArray(obj.highlights, 4),
    concerns: asStringArray(obj.concerns, 3),
    recommendations: asStringArray(obj.recommendations, 4),
    totals: t,
    model: result.model,
    usage: usageOf(result),
  };
}
