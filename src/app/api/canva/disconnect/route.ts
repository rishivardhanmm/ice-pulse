import { disconnect } from '@/integrations/canva';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Removes stored tokens and marks the Canva connection disconnected. */
export async function POST() {
  try {
    await disconnect();
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
