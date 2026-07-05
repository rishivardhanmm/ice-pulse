import { getDashboardOverview } from '@/server/services/dashboard.service';
import { getSmartSignals } from '@/server/services/signals.service';
import { getGoogleAdsAccountName } from '@/server/db/repositories/platformAccounts.repo';
import type { CanvaReportPayload } from '@/lib/types';

/**
 * Builds the Pulse → Canva report payload from REAL dashboard data (Google Ads
 * aggregates + deterministic signals). This is the foundation model that future
 * Canva report generation (autofill) will consume. No mock data in production.
 */
export async function buildCanvaReportPayload(
  from: string,
  to: string,
): Promise<CanvaReportPayload> {
  const [overview, signalsDto, account] = await Promise.all([
    getDashboardOverview(from, to),
    getSmartSignals(from, to).catch(() => null),
    getGoogleAdsAccountName().catch(() => null),
  ]);

  const t = overview.summary;
  const campaigns = overview.topCampaigns ?? [];
  const top = [...campaigns].sort((a, b) => b.spend - a.spend)[0] ?? null;
  // "worst" = lowest conversions-per-spend among campaigns that actually spent.
  const worst =
    [...campaigns]
      .filter((c) => c.spend > 0)
      .sort((a, b) => a.conversions / (a.spend || 1) - b.conversions / (b.spend || 1))[0] ?? null;

  const signals = signalsDto?.signals ?? [];
  const lead = signals.find((s) => s.severity === 'warning') ?? signals[0] ?? null;
  const recommendation = lead ? (lead.action ?? lead.detail) : null;

  return {
    clientName: account ?? null,
    campaignName: null, // account-level report; campaign selection comes later
    dateRange: { from, to },
    spend: t.spend,
    impressions: t.impressions,
    clicks: t.clicks,
    ctr: t.ctr,
    cpc: t.averageCpc,
    conversions: t.conversions,
    costPerConversion: t.costPerConversion,
    topCampaign: top?.name ?? null,
    worstCampaign: worst?.name ?? null,
    recommendation,
    generatedAt: new Date().toISOString(),
  };
}
