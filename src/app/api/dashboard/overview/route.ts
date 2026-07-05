import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDashboardOverview } from '@/server/services/dashboard.service';
import { getCampaignIdsForClient } from '@/server/db/repositories/campaigns.repo';
import { getMetaCampaignIdsForClient } from '@/server/db/repositories/meta-metrics.repo';
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
    let metaCampaignIds: number[] | undefined;

    // Only admin/internal can use clientId or campaignIds filters
    if (session.user.role === 'admin' || session.user.role === 'internal') {
      const clientIdParam = sp.get('clientId');
      const campaignIdsParam = sp.get('campaignIds');
      const metaCampaignIdsParam = sp.get('metaCampaignIds');

      if (clientIdParam) {
        const clientId = parseInt(clientIdParam, 10);
        if (Number.isFinite(clientId)) {
          // Scope BOTH channels to this specific client — never fall back to
          // unscoped/global Meta data once a client filter is applied.
          [campaignIds, metaCampaignIds] = await Promise.all([
            getCampaignIdsForClient(clientId),
            getMetaCampaignIdsForClient(clientId),
          ]);
        }
      } else if (campaignIdsParam || metaCampaignIdsParam) {
        // Ad-hoc hand-picked campaigns (FilterBar), channel-split by the
        // caller. A missing param means "none of that channel selected", not
        // "unscoped" — so an unrelated channel's global data never leaks in.
        campaignIds = campaignIdsParam
          ? campaignIdsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite)
          : [];
        metaCampaignIds = metaCampaignIdsParam
          ? metaCampaignIdsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite)
          : [];
      }
    }

    const channelParam = sp.get('channel');
    const channel =
      channelParam === 'google' || channelParam === 'meta' ? channelParam : 'all';

    const data = await getDashboardOverview(from, to, campaignIds, channel, metaCampaignIds);
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
