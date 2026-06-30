'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/lib/types';
import { formatCompactNumber, formatCurrency, formatPercent } from '@/lib/format';

type MetricKey = 'spend' | 'clicks' | 'impressions' | 'conversions' | 'ctr';

// Recharts renders to SVG attributes which do not resolve CSS variables, so the
// axis/grid colours are concrete mid-tones that read well on every theme.
const AXIS_COLOR = '#8b7fb0';
const GRID_COLOR = 'rgba(140,130,170,0.2)';

function formatAxisDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
  fmt: (n: number) => string;
  metricLabel: string;
}

function ChartTooltip({ active, payload, label, fmt, metricLabel }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value ?? 0;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-strong)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="mb-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {formatAxisDate(label ?? '')}
      </div>
      <div className="font-semibold">
        {metricLabel}: {fmt(value)}
      </div>
    </div>
  );
}

export function TrendChart({ points, currency }: { points: TrendPoint[]; currency: string }) {
  const metrics: Array<{ key: MetricKey; label: string; color: string; fmt: (n: number) => string }> = [
    { key: 'spend', label: 'Spend', color: '#FFD500', fmt: (n) => formatCurrency(n, currency) },
    { key: 'clicks', label: 'Clicks', color: '#00D9D0', fmt: (n) => formatCompactNumber(n) },
    { key: 'impressions', label: 'Impressions', color: '#C79DFE', fmt: (n) => formatCompactNumber(n) },
    { key: 'conversions', label: 'Conversions', color: '#22D3A0', fmt: (n) => formatCompactNumber(n) },
    { key: 'ctr', label: 'CTR', color: '#FF86EF', fmt: (n) => formatPercent(n) },
  ];
  const [active, setActive] = useState<MetricKey>('spend');
  const metric = metrics.find((m) => m.key === active) ?? metrics[0];
  const data = points.map((p) => ({ date: p.date, value: p[active] }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {metrics.map((m) => {
          const isActive = m.key === active;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setActive(m.key)}
              className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
              style={
                isActive
                  ? { background: 'var(--gold)', color: '#14082a', fontWeight: 700 }
                  : { background: 'var(--surface)', color: 'var(--text-secondary)' }
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="ice-trend-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => metric.fmt(v)}
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip
              cursor={{ stroke: GRID_COLOR }}
              content={<ChartTooltip fmt={metric.fmt} metricLabel={metric.label} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={metric.color}
              strokeWidth={2}
              fill="url(#ice-trend-grad)"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
