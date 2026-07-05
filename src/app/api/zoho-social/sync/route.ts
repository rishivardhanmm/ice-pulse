import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { zohoSocialConnector } from '@/integrations/zoho-social';
import { defaultRange, isValidDateStr } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonError('Unauthorised', 401);
  if (session.user.role !== 'admin' && session.user.role !== 'internal') {
    return jsonError('Forbidden', 403);
  }

  let body: { from?: string; to?: string } = {};
  try {
    body = (await req.json()) as { from?: string; to?: string };
  } catch {
    body = {};
  }

  const def = defaultRange(90);
  const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
  const to = isValidDateStr(body.to) ? (body.to as string) : def.to;

  const result = await zohoSocialConnector.sync({ from, to, triggeredBy: 'api' });
  return jsonOk(result, result.status === 'success' ? 200 : 502);
}

