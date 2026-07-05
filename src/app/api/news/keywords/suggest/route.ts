import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { isAiConfigured } from '@/server/config/env';
import { suggestNewsKeywords } from '@/server/services/news.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** AI-suggested keywords to broaden the news feed (internal/admin). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }
  try {
    const keywords = await suggestNewsKeywords();
    return jsonOk({ keywords });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
