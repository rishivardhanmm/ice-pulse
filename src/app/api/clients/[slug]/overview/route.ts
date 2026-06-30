import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError, parseDateRange } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { getPool, sql } from '@/server/db/pool';
import { getCampaignIdsForClient } from '@/server/db/repositories/campaigns.repo';
import {
  getSummaryForCampaigns,
  getTrendsForCampaigns,
  getCampaignAggregatesForClient,
} from '@/server/db/repositories/metrics.repo';
import { getClientBudget } from '@/server/db/repositories/budgets.repo';
import { getGoogleAdsCurrency } from '@/server/db/repositories/platformAccounts.repo';
import { deriveTotals } from '@/server/db/utils';
import { previousRange } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return jsonError('Unauthenticated', 401);

    // Resolve client from slug
    const pool = await getPool();
    const clientRes = await pool
      .request()
      .input('slug', sql.NVarChar(120), params.slug)
      .query(`SELECT id, name, slug FROM dbo.clients WHERE slug = @slug AND status = 'active'`);

    if (!clientRes.recordset[0]) return jsonError('Client not found', 404);
    const client = clientRes.recordset[0] as { id: number; name: string; slug: string };

    // Access control: client role users can only view their own client
    if (
      session.user.role === 'client' &&
      session.user.clientId !== client.id
    ) {
      return jsonError('Forbidden', 403);
    }

    const { from, to } = parseDateRange(new URL(req.url).searchParams);
    const prev = previousRange(from, to);

    const campaignIds = await getCampaignIdsForClient(client.id);

    const [totals, prevTotals, trends, rawCampaigns, currency, budget] = await Promise.all([
      getSummaryForCampaigns(from, to, campaignIds),
      getSummaryForCampaigns(prev.from, prev.to, campaignIds),
      getTrendsForCampaigns(from, to, campaignIds),
      getCampaignAggregatesForClient(from, to, campaignIds),
      getGoogleAdsCurrency(),
      getClientBudget(client.id),
    ]);

    return jsonOk({
      client: { id: client.id, name: client.name, slug: client.slug },
      dateRange: { from, to },
      currency: currency ?? 'GBP',
      totals,
      previousTotals: prevTotals,
      trends,
      campaigns: rawCampaigns,
      campaignCount: campaignIds.length,
      budget: budget ? { pctUsed: budget.pctUsed, updatedAt: budget.updatedAt } : null,
    });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
