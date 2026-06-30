import { getSignals } from '@/server/services/signals.service';
import { jsonOk, jsonError, parseDateRange } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { from, to } = parseDateRange(new URL(req.url).searchParams);
    const data = await getSignals(from, to);
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
