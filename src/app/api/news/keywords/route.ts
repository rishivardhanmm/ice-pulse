import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { getNewsKeywords, addNewsKeyword } from '@/server/services/news.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  const keywords = await getNewsKeywords();
  return jsonOk({ keywords });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  try {
    const body = (await req.json()) as { keyword?: unknown; clientId?: unknown; isCompetitor?: unknown };
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    if (!keyword) return jsonError('keyword is required.', 400);
    if (keyword.length > 200) return jsonError('keyword must be 200 chars or fewer.', 400);

    const clientId =
      body.clientId != null && body.clientId !== ''
        ? Number(body.clientId)
        : null;

    const kw = await addNewsKeyword({
      keyword,
      clientId: clientId && Number.isFinite(clientId) ? clientId : null,
      userId: Number(session.user.id),
      isCompetitor: body.isCompetitor === true,
    });
    return jsonOk({ keyword: kw }, 201);
  } catch (err) {
    const msg = toErrorMessage(err);
    if (msg.includes('UNIQUE') || msg.includes('duplicate')) {
      return jsonError('That keyword already exists.', 409);
    }
    return jsonError(msg, 500);
  }
}
