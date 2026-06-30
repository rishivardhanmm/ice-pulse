import { getStatus } from '@/integrations/canva';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Value-free Canva connection status (never returns tokens). */
export async function GET() {
  try {
    return jsonOk(await getStatus());
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
