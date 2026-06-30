import type { CampaignDTO, InsightDTO, MetricsTotals } from '../../lib/types';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/format';

/**
 * Deterministic, rule-based insight cards. NOT AI — these are simple
 * comparisons over the already-aggregated campaign data. The future AI layer
 * (src/ai) will live alongside these, clearly labelled.
 */
export function buildInsights(
  campaigns: CampaignDTO[],
  totals: MetricsTotals,
  currency: string,
): InsightDTO[] {
  if (campaigns.length === 0) return [];

  const insights: InsightDTO[] = [];
  const withSpend = campaigns.filter((c) => c.spend > 0);
  const withImpressions = campaigns.filter((c) => c.impressions > 0);

  if (withSpend.length > 0) {
    const top = withSpend.reduce((a, b) => (b.spend > a.spend ? b : a));
    insights.push({
      id: 'highest-spend',
      label: 'Highest spend campaign',
      value: top.name,
      body: `${formatCurrency(top.spend, currency)} invested — ${formatNumber(top.clicks)} clicks at ${formatPercent(top.ctr)} CTR.`,
      tone: 'info',
      available: true,
    });
  }

  if (withImpressions.length > 0) {
    const best = withImpressions.reduce((a, b) => (b.ctr > a.ctr ? b : a));
    insights.push({
      id: 'best-ctr',
      label: 'Best CTR campaign',
      value: best.name,
      body: `${formatPercent(best.ctr)} click-through rate from ${formatNumber(best.impressions)} impressions.`,
      tone: 'positive',
      available: true,
    });
  }

  if (withSpend.length > 0) {
    const low = withSpend.reduce((a, b) => (b.clicks < a.clicks ? b : a));
    insights.push({
      id: 'low-clicks',
      label: 'Campaign with low clicks',
      value: low.name,
      body: `Only ${formatNumber(low.clicks)} clicks from ${formatCurrency(low.spend, currency)} spend — worth a review.`,
      tone: 'warning',
      available: true,
    });
  }

  if (totals.conversions > 0) {
    insights.push({
      id: 'conversions',
      label: 'Conversions',
      value: `${formatNumber(totals.conversions)} conversions`,
      body:
        totals.costPerConversion != null
          ? `Averaging ${formatCurrency(totals.costPerConversion, currency)} per conversion across all campaigns.`
          : 'Conversions recorded across campaigns in this period.',
      tone: 'positive',
      available: true,
    });
  } else {
    insights.push({
      id: 'conversions',
      label: 'Conversions',
      value: 'Conversion data not available yet',
      body: 'No conversions recorded for this period yet, or conversion tracking is not set up in Google Ads.',
      tone: 'info',
      available: false,
    });
  }

  return insights;
}
