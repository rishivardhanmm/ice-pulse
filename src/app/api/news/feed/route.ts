import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { isGNewsConfigured } from '@/server/config/env';
import { getNewsFeed } from '@/server/services/news.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  if (!isGNewsConfigured()) {
    return jsonError('not_configured', 503, { detail: 'Add GNEWS_API_KEY to .env.local to enable the live news feed.' });
  }

  const sp = new URL(req.url).searchParams;
  const force = sp.get('force') === 'true';

  try {
    const { articles, rateLimited } = await getNewsFeed(force, Number(session.user.id));
    return jsonOk({ articles, rateLimited: rateLimited ?? false });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
