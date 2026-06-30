import { getGoogleAdsConnectionStatus } from '@/server/services/dashboard.service';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getGoogleAdsConnectionStatus();
    return jsonOk(status);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
