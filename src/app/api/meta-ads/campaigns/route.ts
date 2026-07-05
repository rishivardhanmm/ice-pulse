import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMetaCampaignAggregates } from '@/server/db/repositories/meta-metrics.repo';
import { getMetaAdsCurrency } from '@/server/db/repositories/platformAccounts.repo';
import { jsonOk, jsonError, parseDateRange } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import type { MetaCampaignDTO, MetaCampaignListDTO, MetricsTotals } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Meta Ads campaign list with metrics aggregated over the date range. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const sp = new URL(req.url).searchParams;
  const { from, to } = parseDateRange(sp, 30);
  const status = sp.get('status')?.trim() ?? '';
  const objective = sp.get('objective')?.trim() ?? '';
  const search = sp.get('search')?.trim().toLowerCase() ?? '';

  try {
    const [rows, currency] = await Promise.all([
      getMetaCampaignAggregates(from, to),
      getMetaAdsCurrency().then((c) => c ?? 'GBP'),
    ]);

    const all: MetaCampaignDTO[] = rows.map((r) => {
      const spend = Number(r.spend);
      const impressions = Number(r.impressions);
      const clicks = Number(r.clicks);
      const conversions = Number(r.conversions);
      return {
        id: r.id,
        metaCampaignId: r.meta_campaign_id,
        name: r.campaign_name ?? r.meta_campaign_id,
        status: r.campaign_status,
        objective: r.objective,
        spend: round2(spend),
        impressions,
        clicks,
        ctr: impressions > 0 ? round2((100 * clicks) / impressions) : 0,
        conversions: round2(conversions),
        conversionsValue: round2(Number(r.conversions_value)),
        costPerConversion: conversions > 0 ? round2(spend / conversions) : null,
        averageCpc: clicks > 0 ? round2(spend / clicks) : null,
      };
    });

    const statuses = [...new Set(all.map((c) => c.status).filter((s): s is string => !!s))].sort();
    const objectives = [...new Set(all.map((c) => c.objective).filter((o): o is string => !!o))].sort();

    const campaigns = all.filter(
      (c) =>
        (!status || c.status === status) &&
        (!objective || c.objective === objective) &&
        (!search || c.name.toLowerCase().includes(search)),
    );

    const sum = (fn: (c: MetaCampaignDTO) => number) => campaigns.reduce((acc, c) => acc + fn(c), 0);
    const spend = round2(sum((c) => c.spend));
    const impressions = sum((c) => c.impressions);
    const clicks = sum((c) => c.clicks);
    const conversions = round2(sum((c) => c.conversions));
    const totals: MetricsTotals = {
      spend,
      impressions,
      clicks,
      ctr: impressions > 0 ? round2((100 * clicks) / impressions) : 0,
      conversions,
      conversionsValue: round2(sum((c) => c.conversionsValue)),
      costPerConversion: conversions > 0 ? round2(spend / conversions) : null,
      averageCpc: clicks > 0 ? round2(spend / clicks) : null,
      conversionRate: clicks > 0 ? round2((100 * conversions) / clicks) : null,
    };

    const result: MetaCampaignListDTO = {
      dateRange: { from, to },
      currency,
      campaigns,
      totals,
      filters: { statuses, objectives },
    };
    return jsonOk(result);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
