import { listSyncRuns } from '@/server/db/repositories/syncRuns.repo';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const raw = Number(sp.get('limit') ?? 25);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 200) : 25;
    const runs = await listSyncRuns(limit);
    return jsonOk({ runs });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
