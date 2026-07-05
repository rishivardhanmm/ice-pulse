import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateClientNarrative } from '@/ai/ai.service';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError, parseDateRange } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { getPool, sql } from '@/server/db/pool';
import { getCampaignIdsForClient } from '@/server/db/repositories/campaigns.repo';
import {
  getCampaignAggregatesForClient,
  getSummaryForCampaigns,
} from '@/server/db/repositories/metrics.repo';
import {
  getMetaCampaignAggregatesForClient,
  getMetaCampaignIdsForClient,
  getMetaSummaryRawForCampaigns,
} from '@/server/db/repositories/meta-metrics.repo';
import { combineTotals, mapMetaAggregatesToCampaignDTOs } from '@/server/services/dashboard.service';
import { getGoogleAdsCurrency } from '@/server/db/repositories/platformAccounts.repo';
import { getClientBudgetPacing } from '@/server/services/budget-pacing.service';
import { deriveTotals } from '@/server/db/utils';
import { previousRange } from '@/lib/date';
import type { ClientAiSummaryDTO } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One narrative per client+range every 6 hours — clients refreshing their
// dashboard shouldn't burn tokens on identical data.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { data: ClientAiSummaryDTO; expiresAt: number }>();

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return jsonError('Unauthenticated', 401);
    if (!isAiConfigured()) return jsonError('AI is not configured.', 503);

    const pool = await getPool();
    const clientRes = await pool
      .request()
      .input('slug', sql.NVarChar(120), params.slug)
      .query(`SELECT id, name, slug FROM dbo.clients WHERE slug = @slug AND status = 'active'`);
    if (!clientRes.recordset[0]) return jsonError('Client not found', 404);
    const client = clientRes.recordset[0] as { id: number; name: string };

    // Client users can only see their own narrative.
    if (session.user.role === 'client' && session.user.clientId !== client.id) {
      return jsonError('Forbidden', 403);
    }

    const { from, to } = parseDateRange(new URL(req.url).searchParams);
    const cacheKey = `${client.id}:${from}:${to}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() < hit.expiresAt) return jsonOk(hit.data);

    const [campaignIds, metaCampaignIds] = await Promise.all([
      getCampaignIdsForClient(client.id),
      getMetaCampaignIdsForClient(client.id),
    ]);
    if (campaignIds.length === 0 && metaCampaignIds.length === 0) {
      return jsonError('No campaigns are assigned to this client yet.', 400);
    }

    const prev = previousRange(from, to);
    const [gTotals, gPrevTotals, gCampaigns, currency, pacing, mTotalsRaw, mPrevTotalsRaw, mCampaignRows] =
      await Promise.all([
        getSummaryForCampaigns(from, to, campaignIds),
        getSummaryForCampaigns(prev.from, prev.to, campaignIds),
        getCampaignAggregatesForClient(from, to, campaignIds),
        getGoogleAdsCurrency().then((c) => c ?? 'GBP'),
        getClientBudgetPacing(client.id, campaignIds, metaCampaignIds).catch(() => null),
        getMetaSummaryRawForCampaigns(from, to, metaCampaignIds),
        getMetaSummaryRawForCampaigns(prev.from, prev.to, metaCampaignIds),
        getMetaCampaignAggregatesForClient(from, to, metaCampaignIds),
      ]);

    const totals = combineTotals(gTotals, deriveTotals(mTotalsRaw));
    const prevTotals = combineTotals(gPrevTotals, deriveTotals(mPrevTotalsRaw));
    const campaigns = [...gCampaigns, ...mapMetaAggregatesToCampaignDTOs(mCampaignRows)];

    const result = await generateClientNarrative({
      clientName: client.name,
      from,
      to,
      currency,
      totals,
      previousTotals: prevTotals,
      topCampaigns: campaigns
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5)
        .map((c) => ({ name: c.name, spend: c.spend, clicks: c.clicks, conversions: c.conversions })),
      pacing:
        pacing && pacing.mode === 'computed' && pacing.monthlyBudget != null
          ? {
              monthlyBudget: pacing.monthlyBudget,
              spentThisMonth: pacing.spentThisMonth,
              projectedSpend: pacing.projectedSpend,
              status: pacing.status,
            }
          : null,
    });

    const data: ClientAiSummaryDTO = {
      narrative: result.narrative,
      whatToWatch: result.whatToWatch,
      model: result.model,
      usage: result.usage,
    };
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
