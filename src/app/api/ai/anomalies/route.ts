import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getRecentAnomalies, getRecentAnomaliesForClient } from '@/server/services/anomaly.service';
import { getCampaignIdsForClient } from '@/server/db/repositories/campaigns.repo';
import { getMetaCampaignIdsForClient } from '@/server/db/repositories/meta-metrics.repo';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recent metric anomalies. Staff see everything; client users are force-scoped
 * to anomalies on their own campaigns only.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError('Unauthenticated', 401);

  const daysParam = Number(new URL(req.url).searchParams.get('days'));
  const days = Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= 90 ? daysParam : 14;

  try {
    if (session.user.role === 'client') {
      if (!session.user.clientId) return jsonOk({ anomalies: [] });
      const [campaignIds, metaCampaignIds] = await Promise.all([
        getCampaignIdsForClient(session.user.clientId),
        getMetaCampaignIdsForClient(session.user.clientId),
      ]);
      const anomalies = await getRecentAnomaliesForClient(campaignIds, metaCampaignIds, days);
      return jsonOk({ anomalies });
    }
    const anomalies = await getRecentAnomalies(days);
    return jsonOk({ anomalies });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
