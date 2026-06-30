import { getPool } from '@/server/db/pool';
import { describeConfigState } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let config: ReturnType<typeof describeConfigState> | null = null;
  try {
    config = describeConfigState();
  } catch {
    config = null;
  }

  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    return jsonOk({
      status: 'ok',
      database: 'connected',
      config,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return jsonError('Database not reachable', 503, {
      status: 'degraded',
      database: 'disconnected',
      config,
      detail: toErrorMessage(err),
    });
  }
}
