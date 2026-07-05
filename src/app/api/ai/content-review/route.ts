import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { reviewContent } from '@/ai/ai.service';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** AI pre-review of submission content: corrections + tone/brand notes (internal/admin). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }

  let body: { title?: string; caption?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 2000) : '';
  if (!title && !caption) return jsonError('Provide a title or caption to review.', 400);

  try {
    const result = await reviewContent(title, caption);
    return jsonOk(result);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
