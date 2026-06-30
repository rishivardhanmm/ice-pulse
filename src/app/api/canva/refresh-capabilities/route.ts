import { getCanvaConfig } from '@/server/config/env';
import { getActiveConnection } from '@/server/db/repositories/canva.repo';
import { refreshCapabilities } from '@/integrations/canva';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Re-check the connected account's capabilities. Requires an active connection. */
export async function POST() {
  try {
    const conn = await getActiveConnection();
    if (!conn) return jsonError('Canva is not connected.', 409);
    const scopes = conn.scopes ?? getCanvaConfig().scopes;
    const capabilities = await refreshCapabilities(conn.id, scopes);
    return jsonOk({ ok: true, capabilities });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
