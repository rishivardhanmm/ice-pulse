import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { suggestCampaignWindows, type CampaignWindowsResult } from '@/ai/ai.service';
import { getMarketingCalendar } from '@/server/services/news.service';
import { getTrends } from '@/server/db/repositories/metrics.repo';
import { getMetaTrendRows } from '@/server/db/repositories/meta-metrics.repo';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// One AI call per month per day is plenty — planners don't need it fresher.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { data: CampaignWindowsResult; expiresAt: number }>();

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Average clicks/conversions per weekday over the last 90 days, both channels. */
async function getWeekdayPerformance(): Promise<
  Array<{ weekday: string; avgClicks: number; avgConversions: number }>
> {
  const to = new Date().toISOString().slice(0, 10);
  const from = shiftDays(to, -90);

  const [google, meta] = await Promise.all([
    getTrends(from, to).catch(() => []),
    getMetaTrendRows(from, to).catch(() => []),
  ]);

  const byDay = new Map<number, { clicks: number; conversions: number; days: number }>();
  const add = (dateStr: string, clicks: number, conversions: number) => {
    const day = new Date(dateStr).getUTCDay();
    const cur = byDay.get(day) ?? { clicks: 0, conversions: 0, days: 0 };
    cur.clicks += clicks;
    cur.conversions += conversions;
    cur.days += 1;
    byDay.set(day, cur);
  };
  for (const p of google) add(p.date, p.clicks, p.conversions);
  for (const r of meta) add(new Date(r.metric_date).toISOString().slice(0, 10), Number(r.clicks), Number(r.conversions));

  return [...byDay.entries()]
    .map(([day, v]) => ({
      weekday: WEEKDAYS[day],
      avgClicks: Math.round((v.clicks / v.days) * 10) / 10,
      avgConversions: Math.round((v.conversions / v.days) * 10) / 10,
    }))
    .sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday));
}

/** AI-suggested campaign launch windows for a month (internal/admin). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) return jsonError('AI is not configured.', 503);

  const monthParam = new URL(req.url).searchParams.get('month');
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? '')
    ? (monthParam as string)
    : new Date().toISOString().slice(0, 7);

  const hit = cache.get(month);
  if (hit && Date.now() < hit.expiresAt) return jsonOk(hit.data);

  try {
    const [calendar, weekdays] = await Promise.all([
      getMarketingCalendar(month).catch(() => []),
      getWeekdayPerformance(),
    ]);

    const result = await suggestCampaignWindows(
      month,
      calendar.map((e) => ({ date: e.date, event: e.event, category: e.category })),
      weekdays,
    );
    // Only cache useful answers — an empty set should retry next request.
    if (result.windows.length > 0) {
      cache.set(month, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return jsonOk(result);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
