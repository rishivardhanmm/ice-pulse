import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateAdCopy } from '@/ai/ai.service';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import type { AdCopyRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generate platform-aware ad copy variants (internal/admin). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }

  let body: Partial<AdCopyRequest> = {};
  try {
    body = (await req.json()) as Partial<AdCopyRequest>;
  } catch {
    body = {};
  }

  const platform = body.platform === 'meta' ? 'meta' : body.platform === 'google' ? 'google' : null;
  const product = typeof body.product === 'string' ? body.product.trim().slice(0, 500) : '';
  if (!platform) return jsonError('platform must be "google" or "meta".', 400);
  if (!product) return jsonError('product is required — describe what the ad promotes.', 400);

  const clamp = (s: unknown, max: number) =>
    typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : undefined;

  try {
    const result = await generateAdCopy({
      platform,
      product,
      audience: clamp(body.audience, 300),
      tone: clamp(body.tone, 100),
      keyPoints: clamp(body.keyPoints, 500),
      newsHook: clamp(body.newsHook, 500),
      variants: typeof body.variants === 'number' ? body.variants : undefined,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
