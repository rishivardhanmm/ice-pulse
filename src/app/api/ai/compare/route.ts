import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { compareCampaigns } from '@/ai/ai.service';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** AI side-by-side comparison of two campaigns (internal/admin). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }

  let body: { campaignIdA?: unknown; campaignIdB?: unknown; from?: string; to?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const idA = Number(body.campaignIdA);
  const idB = Number(body.campaignIdB);
  if (!Number.isFinite(idA) || !Number.isFinite(idB)) {
    return jsonError('campaignIdA and campaignIdB are required.', 400);
  }
  if (idA === idB) return jsonError('Pick two different campaigns to compare.', 400);

  const def = defaultRange(30);
  const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
  const to = isValidDateStr(body.to) ? (body.to as string) : def.to;

  try {
    const result = await compareCampaigns(idA, idB, from, to);
    if (!result) return jsonError('One or both campaigns were not found.', 404);
    return jsonOk(result);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
