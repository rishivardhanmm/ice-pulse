'use client';

import { useState } from 'react';
import { generateClientReport } from '@/lib/api-client';
import { defaultRange, todayUtc } from '@/lib/date';
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatUsd,
} from '@/lib/format';
import type { AiReportDTO } from '@/lib/types';
import { useAiStatus } from '@/components/ai/AiStatusProvider';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

function DateInput({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      aria-label={label}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="rounded-lg px-2.5 py-1.5 text-xs outline-none"
      style={{ background: 'var(--search-bg)', border: '1px solid var(--search-border)', color: 'var(--search-text)', colorScheme: 'light' }}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}>
      <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-extrabold" style={{ color: 'var(--section-heading)' }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, items, icon, color }: { title: string; items: string[]; icon: string; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--section-heading)' }}>
        <i className={`bi ${icon}`} style={{ color }} aria-hidden="true" />
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-dot mt-0.5" style={{ color }} aria-hidden="true" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportDoc({ report }: { report: AiReportDTO }) {
  const t = report.totals;
  const cur = report.currency;
  return (
    <Card className="report-doc">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {report.account ?? 'Google Ads'} · {formatDate(report.dateRange.from)} – {formatDate(report.dateRange.to)}
          </p>
          <h2 className="ice-section-title text-xl leading-tight">{report.headline}</h2>
        </div>
        <button onClick={() => window.print()} className="ice-pill-btn-ghost no-print" type="button">
          <i className="bi bi-printer" aria-hidden="true" /> Print
        </button>
      </div>

      <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {report.summary}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Spend" value={formatCurrency(t.spend, cur)} />
        <Stat label="Impressions" value={formatCompactNumber(t.impressions)} />
        <Stat label="Clicks" value={formatNumber(t.clicks)} />
        <Stat label="CTR" value={formatPercent(t.ctr)} />
        <Stat label="Conversions" value={formatNumber(t.conversions)} />
        <Stat label="Cost / Conv." value={t.costPerConversion != null ? formatCurrency(t.costPerConversion, cur) : '—'} />
      </div>

      <Section title="Highlights" items={report.highlights} icon="bi-star-fill" color="var(--green)" />
      <Section title="Concerns" items={report.concerns} icon="bi-exclamation-triangle-fill" color="var(--orange)" />
      <Section title="Recommendations" items={report.recommendations} icon="bi-lightbulb-fill" color="#b89600" />

      <p className="mt-5 text-[10px] no-print" style={{ color: 'var(--text-muted)' }}>
        AI-generated · {report.model} · {report.usage.totalTokens} tokens · {formatUsd(report.usage.estimatedCostUsd)}
      </p>
    </Card>
  );
}

export function ReportsView() {
  const { configured } = useAiStatus();
  const def = defaultRange(90);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AiReportDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await generateClientReport({ from, to }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate the report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Client Reports" subtitle="Generate a client-ready performance report from your live data.">
        <div className="no-print flex flex-wrap items-center gap-2">
          <DateInput value={from} max={to} onChange={setFrom} label="From date" />
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <DateInput value={to} min={from} max={todayUtc()} onChange={setTo} label="To date" />
          <button onClick={run} disabled={loading || !configured} className="ice-pill-btn-gold" type="button">
            {loading ? (
              <>
                <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Generating…
              </>
            ) : (
              <>
                <i className="bi bi-stars" aria-hidden="true" /> {report ? 'Regenerate' : 'Generate report'}
              </>
            )}
          </button>
        </div>
      </PageHeader>

      {!configured && (
        <Card>
          <EmptyState
            icon="bi-stars"
            title="AI is not configured"
            description="Set AI_ENABLED=true and OPENAI_API_KEY in .env.local to generate AI reports."
          />
        </Card>
      )}
      {error && (
        <Card>
          <ErrorState message={error} onRetry={run} />
        </Card>
      )}
      {configured && !error && !report && !loading && (
        <Card>
          <EmptyState
            icon="bi-file-earmark-text"
            title="No report yet"
            description="Pick a date range and click Generate to produce a client-ready summary, highlights, concerns and recommendations — grounded in your data."
          />
        </Card>
      )}
      {report && <ReportDoc report={report} />}
    </>
  );
}
