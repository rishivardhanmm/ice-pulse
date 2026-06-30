import { getCampaignAggregates } from '../db/repositories/metrics.repo';
import { getGoogleAdsCurrency } from '../db/repositories/platformAccounts.repo';
import { previousRange } from '../../lib/date';
import { formatCurrency, formatNumber } from '../../lib/format';
import type { CampaignDTO, Signal, SignalsDTO } from '../../lib/types';

const MIN_SPEND = 10; // ignore tiny campaigns
const MOVER_PCT = 40; // % change vs previous period to flag
const HIGH_CPA_MULTIPLE = 2; // x the account-average cost/conversion

const SEVERITY_ORDER: Record<Signal['severity'], number> = { warning: 0, info: 1, positive: 2 };

/**
 * Deterministic "what needs attention" signals computed entirely in SQL/JS — no
 * AI, no tokens. Powers the dashboard Needs-attention / Recommended-actions
 * cards and feeds the AI report.
 */
export async function getSignals(from: string, to: string): Promise<SignalsDTO> {
  const prev = previousRange(from, to);
  const [currency, current, previousCampaigns] = await Promise.all([
    getGoogleAdsCurrency().then((c) => c ?? 'GBP'),
    getCampaignAggregates({ from, to }),
    getCampaignAggregates({ from: prev.from, to: prev.to }),
  ]);

  const money = (n: number | null) => formatCurrency(n, currency);
  const prevById = new Map<number, CampaignDTO>(previousCampaigns.map((c) => [c.id, c]));
  const withSpend = current.filter((c) => c.spend >= MIN_SPEND);
  const signals: Signal[] = [];

  // Wasted spend — spending with zero conversions.
  for (const c of withSpend) {
    if (c.conversions === 0) {
      signals.push({
        id: `wasted-${c.id}`,
        kind: 'wasted_spend',
        severity: 'warning',
        title: `Wasted spend: ${c.name}`,
        detail: `${money(c.spend)} spent with 0 conversions in this period.`,
        action: 'Review targeting/creative or pause this campaign.',
        campaignId: c.id,
        campaignName: c.name,
      });
    }
  }

  // High cost per conversion vs the account average.
  const converting = current.filter((c) => c.conversions > 0 && c.costPerConversion != null);
  const avgCpa =
    converting.length > 0
      ? converting.reduce((s, c) => s + (c.costPerConversion as number), 0) / converting.length
      : 0;
  for (const c of converting) {
    const cpa = c.costPerConversion as number;
    if (avgCpa > 0 && cpa >= avgCpa * HIGH_CPA_MULTIPLE && c.spend >= MIN_SPEND) {
      signals.push({
        id: `cpa-${c.id}`,
        kind: 'high_cpa',
        severity: 'warning',
        title: `High cost per conversion: ${c.name}`,
        detail: `${money(cpa)} per conversion — well above the ${money(avgCpa)} account average.`,
        action: 'Check whether the conversion value justifies the cost.',
        campaignId: c.id,
        campaignName: c.name,
      });
    }
  }

  // Big spend movers vs the previous equal-length period.
  for (const c of withSpend) {
    const p = prevById.get(c.id);
    if (p && p.spend > 0) {
      const change = ((c.spend - p.spend) / p.spend) * 100;
      if (Math.abs(change) >= MOVER_PCT) {
        const up = change > 0;
        signals.push({
          id: `mover-${c.id}`,
          kind: up ? 'spend_up' : 'spend_down',
          severity: 'info',
          title: `Spend ${up ? 'up' : 'down'} ${Math.abs(Math.round(change))}%: ${c.name}`,
          detail: `${money(c.spend)} vs ${money(p.spend)} in the previous period.`,
          campaignId: c.id,
          campaignName: c.name,
        });
      }
    }
  }

  // A positive highlight: the best converter.
  if (converting.length > 0) {
    const best = converting.reduce((a, b) => (b.conversions > a.conversions ? b : a));
    signals.push({
      id: `top-${best.id}`,
      kind: 'top_performer',
      severity: 'positive',
      title: `Top performer: ${best.name}`,
      detail: `${formatNumber(best.conversions)} conversions${best.costPerConversion != null ? ` at ${money(best.costPerConversion)} each` : ''}.`,
      campaignId: best.id,
      campaignName: best.name,
    });
  }

  signals.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { dateRange: { from, to }, currency, signals: signals.slice(0, 10) };
}
