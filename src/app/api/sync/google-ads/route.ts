import { googleAdsConnector } from '@/integrations/google-ads/connector';
import { jsonOk } from '@/server/api/http';
import { defaultRange, isValidDateStr } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Trigger a Google Ads sync. Body (optional): { from?: string; to?: string }. */
export async function POST(req: Request) {
  let body: { from?: string; to?: string } = {};
  try {
    body = (await req.json()) as { from?: string; to?: string };
  } catch {
    body = {};
  }

  const def = defaultRange(30);
  const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
  const to = isValidDateStr(body.to) ? (body.to as string) : def.to;
  const range = from > to ? { from: to, to: from } : { from, to };

  const result = await googleAdsConnector.sync({ ...range, triggeredBy: 'api' });
  return jsonOk(result, result.status === 'success' ? 200 : 502);
}
