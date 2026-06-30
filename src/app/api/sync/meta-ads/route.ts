import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { metaAdsConnector } from '@/integrations/meta-ads/connector';
import { jsonOk, jsonError } from '@/server/api/http';
import { defaultRange, isValidDateStr } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Trigger a Meta Ads sync (admin/internal only). Body: { from?: string; to?: string } */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  let body: { from?: string; to?: string } = {};
  try { body = (await req.json()) as { from?: string; to?: string }; } catch { body = {}; }

  const def = defaultRange(30);
  const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
  const to = isValidDateStr(body.to) ? (body.to as string) : def.to;
  const range = from > to ? { from: to, to: from } : { from, to };

  const result = await metaAdsConnector.sync({ ...range, triggeredBy: 'api' });
  return jsonOk(result, result.status === 'success' ? 200 : 502);
}
