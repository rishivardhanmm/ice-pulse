import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDashboardOverview } from '@/server/services/dashboard.service';
import { getCampaignIdsForClient } from '@/server/db/repositories/campaigns.repo';
import { jsonOk, jsonError, parseDateRange } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return jsonError('Unauthenticated', 401);

    const sp = new URL(req.url).searchParams;
    const { from, to } = parseDateRange(sp);

    let campaignIds: number[] | undefined;

    // Only admin/internal can use clientId or campaignIds filters
    if (session.user.role === 'admin' || session.user.role === 'internal') {
      const clientIdParam = sp.get('clientId');
      const campaignIdsParam = sp.get('campaignIds');

      if (clientIdParam) {
        const clientId = parseInt(clientIdParam, 10);
        if (Number.isFinite(clientId)) {
          campaignIds = await getCampaignIdsForClient(clientId);
        }
      } else if (campaignIdsParam) {
        campaignIds = campaignIdsParam
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter(Number.isFinite);
      }
    }

    const data = await getDashboardOverview(from, to, campaignIds);
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
