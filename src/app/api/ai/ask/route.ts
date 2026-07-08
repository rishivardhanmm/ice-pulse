import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { askAi } from '@/ai/ai.service';
import type { AiMessage } from '@/ai/provider';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { toErrorMessage } from '@/server/logger';
import { getCampaignIdsForClient } from '@/server/db/repositories/campaigns.repo';
import { getMetaCampaignIdsForClient } from '@/server/db/repositories/meta-metrics.repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeHistory(raw: unknown): AiMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: AiMessage[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const { role, content } = item as { role?: unknown; content?: unknown };
      if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
        out.push({ role, content: content.slice(0, 1000) });
      }
    }
  }
  return out.slice(-24);
}

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }
  try {
    const session = await getServerSession(authOptions);
    if (!session) return jsonError('Unauthenticated', 401);

    const body = (await req.json().catch(() => ({}))) as {
      question?: string;
      from?: string;
      to?: string;
      history?: unknown;
    };
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question) return jsonError('A question is required.', 400);

    const def = defaultRange(30);
    const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
    const to = isValidDateStr(body.to) ? (body.to as string) : def.to;
    const range = from > to ? { from: to, to: from } : { from, to };

    // Scope AI to client's campaigns when role is 'client' — both channels,
    // each in its own id space (Google and Meta campaign ids are unrelated).
    let allowedCampaignIds: number[] | undefined;
    let allowedMetaCampaignIds: number[] | undefined;
    if (session.user.role === 'client' && session.user.clientId != null) {
      [allowedCampaignIds, allowedMetaCampaignIds] = await Promise.all([
        getCampaignIdsForClient(session.user.clientId),
        getMetaCampaignIdsForClient(session.user.clientId),
      ]);
    }

    const data = await askAi(
      question.slice(0, 500),
      range.from,
      range.to,
      sanitizeHistory(body.history),
      allowedCampaignIds,
      allowedMetaCampaignIds,
    );
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
