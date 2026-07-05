import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMetaSocialFeed } from '@/server/services/meta-social.service';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Organic Meta page posts for the Social Posts page (internal/admin). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  const force = new URL(req.url).searchParams.get('force') === 'true';
  try {
    const feed = await getMetaSocialFeed(force);
    return jsonOk(feed);
  } catch (err) {
    return jsonError(toErrorMessage(err), 502);
  }
}
