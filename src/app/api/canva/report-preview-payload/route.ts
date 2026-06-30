import { buildCanvaReportPayload } from '@/integrations/canva';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Build the Pulse → Canva report payload from real data (preview, no generation). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
    const def = defaultRange(30);
    const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
    const to = isValidDateStr(body.to) ? (body.to as string) : def.to;
    const payload = await buildCanvaReportPayload(from, to);
    return jsonOk(payload);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
