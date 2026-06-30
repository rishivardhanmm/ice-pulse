import { getCampaignDetail, getDashboardOverview } from '../server/services/dashboard.service';
import { getSignals } from '../server/services/signals.service';
import { getGoogleAdsAccountName } from '../server/db/repositories/platformAccounts.repo';
import { logger } from '../server/logger';
import { runAi, type RunAiResult } from './run';
import type { AiMessage } from './provider';
import { getAiConfig } from '../server/config/env';
import { guardSql } from './sql-guard';
import { runReadOnlyQuery, type AdhocResult } from '../server/db/repositories/adhocQuery.repo';
import { ANSWER_SYSTEM, MAX_ROWS_TO_MODEL, SQL_GEN_SYSTEM } from './sql-schema';
import type {
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
  const lines = [
    `Date range: ${o.dateRange.from} to ${o.dateRange.to}. Currency: ${o.currency}.`,
    `Totals — spend ${t.spend}, impressions ${t.impressions}, clicks ${t.clicks}, ` +
      `CTR ${t.ctr}%, conversions ${t.conversions}, ` +
      `cost/conversion ${t.costPerConversion ?? 'n/a'}, avg CPC ${t.averageCpc ?? 'n/a'}.`,
    'Top campaigns:',
    ...o.topCampaigns.map(
      (c, i) =>
        ` ${i + 1}. ${c.name} [${c.status ?? '?'}, ${c.channelType ?? '?'}] — ` +
        `spend ${c.spend}, clicks ${c.clicks}, CTR ${c.ctr}%, conversions ${c.conversions}`,
    ),
  ];
  return lines.join('\n');
}

export async function generateInsights(from: string, to: string): Promise<AiInsightsResult> {
  const overview = await getDashboardOverview(from, to);
  const system =
    'You are a concise marketing-analytics assistant for ICE Creates analysing Google Ads data. ' +
    'Use ONLY the data provided (currency as given). Respond with a JSON object: ' +
    '{"summary": string (2-3 sentences), "recommendations": string[] (2-4 short, specific, actionable items)}.';
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
  allowedCampaignIds?: number[],
): Promise<AiAskResult> {
  const maxAttempts = Math.max(1, getAiConfig().maxSqlAttempts);
  const usage = emptyUsage();
  let model = '';
  let lastSql = '';
  let lastError = '';
  let feedback = '';
  // Best non-empty result seen so far, so we never dead-end when data exists.
  let best: { answerText: string; obj: Record<string, unknown>; result: AdhocResult; sql: string } | null = null;

  const priorContext = history.map((m) => `${m.role}: ${m.content}`).join('\n');

  // Client scope constraint injected into every SQL generation prompt.
  const campaignFilter =
    allowedCampaignIds && allowedCampaignIds.length > 0
      ? `\n\nSECURITY CONSTRAINT (mandatory): This user is a client with access ONLY to these campaign IDs: ${allowedCampaignIds.join(', ')}. Every query MUST include "AND c.id IN (${allowedCampaignIds.join(', ')})" — no exceptions.`
      : '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // 1) Generate SQL (schema in the system message; only step that sees it).
    const genUser =
      `${priorContext ? `Recent conversation:\n${priorContext}\n\n` : ''}` +
      `Dashboard date range: ${from} to ${to} (use as the default period if the question implies "this period"; otherwise query all dates).\n` +
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
        "That one's a little outside my lane — I'm your Google Ads data assistant, so I'm best with spend, clicks, conversions, CTR or how your campaigns are doing. What would you like to explore? 😊",
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

/** Generates a concise, client-ready report grounded in aggregates + signals. */
export async function generateReport(from: string, to: string): Promise<AiReportDTO> {
  const [overview, signalsDto, accountName] = await Promise.all([
    getDashboardOverview(from, to),
    getSignals(from, to),
    getGoogleAdsAccountName(),
  ]);
  const t = overview.summary;
  const context = [
    `Account: ${accountName ?? 'Google Ads account'}. Period: ${from} to ${to}. Currency: ${overview.currency}.`,
    `Totals — spend ${t.spend}, impressions ${t.impressions}, clicks ${t.clicks}, CTR ${t.ctr}%, ` +
      `conversions ${t.conversions}, cost/conversion ${t.costPerConversion ?? 'n/a'}, avg CPC ${t.averageCpc ?? 'n/a'}.`,
    'Top campaigns:',
    ...overview.topCampaigns.map(
      (c, i) =>
        ` ${i + 1}. ${c.name} [${c.status ?? '?'}] — spend ${c.spend}, clicks ${c.clicks}, CTR ${c.ctr}%, conversions ${c.conversions}`,
    ),
    'Flags:',
    ...(signalsDto.signals.length > 0
      ? signalsDto.signals.map((s) => ` - [${s.severity}] ${s.title}: ${s.detail}`)
      : [' - none']),
  ].join('\n');

  const system =
    'You write a concise, client-ready Google Ads performance report for the agency ICE Creates. ' +
    'Use ONLY the data provided (currency as given) and cite specific figures. Respond with a JSON ' +
    'object: {"headline": string, "summary": string (2-3 sentences), "highlights": string[] (2-4), ' +
    '"concerns": string[] (0-3), "recommendations": string[] (2-4)}.';
  const result = await runAi(
    'report',
    { system, messages: [{ role: 'user', content: context }], json: true, maxTokens: 700 },
    { from, to },
  );
  const obj = parseJsonObject(result.text);
  return {
    account: accountName,
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
