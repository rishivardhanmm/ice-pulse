import { KpiCard } from './KpiCard';
import { Delta } from '@/components/ui/Delta';
import { formatCompactNumber, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { MetricsTotals } from '@/lib/types';

export function KpiGrid({
  summary,
  previous,
  currency,
}: {
  summary: MetricsTotals;
  previous: MetricsTotals | null;
  currency: string;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        accent="gold"
        icon="bi-cash-stack"
        label="Spend"
        value={formatCurrency(summary.spend, currency)}
        delta={previous ? <Delta current={summary.spend} previous={previous.spend} /> : undefined}
      />
      <KpiCard
        accent="teal"
        icon="bi-eye"
        label="Impressions"
        value={formatCompactNumber(summary.impressions)}
        delta={
          previous ? <Delta current={summary.impressions} previous={previous.impressions} /> : undefined
        }
      />
      <KpiCard
        accent="violet"
        icon="bi-cursor"
        label="Clicks"
        value={formatCompactNumber(summary.clicks)}
        delta={previous ? <Delta current={summary.clicks} previous={previous.clicks} /> : undefined}
      />
      <KpiCard
        accent="cerise"
        icon="bi-percent"
        label="CTR"
        value={formatPercent(summary.ctr)}
        delta={previous ? <Delta current={summary.ctr} previous={previous.ctr} /> : undefined}
      />
      <KpiCard
        accent="green"
        icon="bi-bullseye"
        label="Conversions"
        value={formatNumber(summary.conversions)}
        delta={
          previous ? <Delta current={summary.conversions} previous={previous.conversions} /> : undefined
        }
      />
      <KpiCard
        accent="orange"
        icon="bi-tag"
        label="Cost / Conv."
        value={summary.costPerConversion != null ? formatCurrency(summary.costPerConversion, currency) : '—'}
        delta={
          previous && previous.costPerConversion != null && summary.costPerConversion != null ? (
            <Delta current={summary.costPerConversion} previous={previous.costPerConversion} invert />
          ) : undefined
        }
      />
    </div>
  );
}
