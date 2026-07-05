import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { listRecentPostIdeas, runDailyPostIdeas } from '@/server/services/post-ideas.service';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recent AI post ideas (internal/admin). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  const daysParam = Number(new URL(req.url).searchParams.get('days'));
  const days = Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= 30 ? daysParam : 7;
  try {
    const ideas = await listRecentPostIdeas(days);
    return jsonOk({ ideas });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}

/** Generate a fresh batch of ideas now (internal/admin). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }
  try {
    const result = await runDailyPostIdeas(true);
    return jsonOk({ stored: result.stored });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
