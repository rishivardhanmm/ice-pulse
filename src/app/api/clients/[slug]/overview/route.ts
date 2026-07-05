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
import {
  getMetaCampaignAggregatesForClient,
  getMetaCampaignIdsForClient,
  getMetaSummaryRawForCampaigns,
  getMetaTrendRowsForCampaigns,
} from '@/server/db/repositories/meta-metrics.repo';
import {
  combineTotals,
  combineTrends,
  mapMetaAggregatesToCampaignDTOs,
  mapMetaTrendRows,
} from '@/server/services/dashboard.service';
import { getClientBudget } from '@/server/db/repositories/budgets.repo';
import { getClientBudgetPacing } from '@/server/services/budget-pacing.service';
import { getGoogleAdsCurrency } from '@/server/db/repositories/platformAccounts.repo';
import { deriveTotals, EMPTY_TOTALS } from '@/server/db/utils';
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

    const [campaignIds, metaCampaignIds] = await Promise.all([
      getCampaignIdsForClient(client.id),
      getMetaCampaignIdsForClient(client.id),
    ]);

    const [
      gTotals,
      gPrevTotals,
      gTrends,
      gCampaigns,
      currency,
      budget,
      pacing,
      mTotalsRaw,
      mPrevTotalsRaw,
      mTrendRows,
      mCampaignRows,
    ] = await Promise.all([
      getSummaryForCampaigns(from, to, campaignIds),
      getSummaryForCampaigns(prev.from, prev.to, campaignIds),
      getTrendsForCampaigns(from, to, campaignIds),
      getCampaignAggregatesForClient(from, to, campaignIds),
      getGoogleAdsCurrency(),
      getClientBudget(client.id),
      getClientBudgetPacing(client.id, campaignIds, metaCampaignIds).catch(() => null),
      getMetaSummaryRawForCampaigns(from, to, metaCampaignIds),
      getMetaSummaryRawForCampaigns(prev.from, prev.to, metaCampaignIds),
      getMetaTrendRowsForCampaigns(from, to, metaCampaignIds),
      getMetaCampaignAggregatesForClient(from, to, metaCampaignIds),
    ]);

    const hasMeta = metaCampaignIds.length > 0;
    const mTotals = deriveTotals(mTotalsRaw);
    const mPrevTotals = deriveTotals(mPrevTotalsRaw);
    const mTrends = mapMetaTrendRows(mTrendRows);
    const mCampaigns = mapMetaAggregatesToCampaignDTOs(mCampaignRows);

    const totals = hasMeta ? combineTotals(gTotals, mTotals) : gTotals;
    const previousTotals = hasMeta ? combineTotals(gPrevTotals, mPrevTotals) : gPrevTotals;
    const trends = hasMeta ? combineTrends(gTrends, mTrends) : gTrends;
    const campaigns = [...gCampaigns, ...mCampaigns];

    return jsonOk({
      client: { id: client.id, name: client.name, slug: client.slug },
      dateRange: { from, to },
      currency: currency ?? 'GBP',
      totals,
      previousTotals,
      trends,
      campaigns,
      campaignCount: campaignIds.length + metaCampaignIds.length,
      budget: budget ? { pctUsed: budget.pctUsed, updatedAt: budget.updatedAt } : null,
      pacing,
    });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
