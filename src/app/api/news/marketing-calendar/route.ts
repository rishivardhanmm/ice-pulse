import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { isAiConfigured } from '@/server/config/env';
import { getMarketingCalendar } from '@/server/services/news.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  if (!isAiConfigured()) {
    return jsonError('not_configured', 503, { detail: 'AI must be enabled to generate the marketing calendar.' });
  }

  const sp = new URL(req.url).searchParams;
  // Defaults to current month
  const rawMonth = sp.get('month');
  const monthStr = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
    ? rawMonth
    : new Date().toISOString().slice(0, 7);

  try {
    const events = await getMarketingCalendar(monthStr);
    return jsonOk({ events, month: monthStr });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
