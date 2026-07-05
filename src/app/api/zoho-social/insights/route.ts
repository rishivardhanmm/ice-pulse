import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { getAiSocialInsights } from '@/server/services/zoho-social.service';
import { isAiConfigured } from '@/server/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonError('Unauthorised', 401);
  if (session.user.role !== 'admin' && session.user.role !== 'internal') {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured.', 503);
  }

  const days = Number(new URL(req.url).searchParams.get('days') ?? '90');
  try {
    const insights = await getAiSocialInsights(isNaN(days) ? 90 : days);
    return jsonOk(insights);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Insights failed.', 500);
  }
}

