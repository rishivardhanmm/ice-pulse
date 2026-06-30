import { getActiveConnection } from '@/server/db/repositories/canva.repo';
import { syncBrandTemplates } from '@/integrations/canva';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sync the brand templates the connected user can access. Requires an active connection. */
export async function POST() {
  try {
    const conn = await getActiveConnection();
    if (!conn) return jsonError('Canva is not connected.', 409);
    const result = await syncBrandTemplates(conn.id);
    return jsonOk(result);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
