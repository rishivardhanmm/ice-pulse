import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { getSocialPosts } from '@/server/services/zoho-social.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonError('Unauthorised', 401);

  const { searchParams } = new URL(req.url);
  const network = searchParams.get('network') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const clientIdRaw = searchParams.get('clientId');
  const clientId = clientIdRaw ? Number(clientIdRaw) : undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

  const posts = await getSocialPosts({ network, from, to, clientId, limit });
  return jsonOk(posts);
}

