'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AiChartSpec } from '@/lib/types';

const COLORS = ['#FFD500', '#00D9D0', '#C79DFE', '#FF86EF', '#22D3A0', '#FF9D4D', '#5B8DEF', '#F2545B'];
const AXIS = '#8b7fb0';
const GRID = 'rgba(140,130,170,0.2)';

function fmtNum(v: number | string): string {
  return typeof v === 'number' ? v.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : v;
}

/** Dates → "DD MMM"; long category labels are left intact (axes give them room). */
function formatDate(v: unknown): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  return s;
}

function truncate(v: unknown, n: number): string {
  const s = String(v ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid var(--border-strong)' };

/** Pivot long rows (x, series, y) into wide rows keyed by x, one column per (top) series value. */
function pivotSeries(
  rows: Array<Record<string, unknown>>,
  xKey: string,
  yKey: string,
  seriesKey: string,
  maxSeries = 6,
): { data: Array<Record<string, unknown>>; seriesKeys: string[] } {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const s = String(r[seriesKey] ?? '');
    totals.set(s, (totals.get(s) ?? 0) + (Number(r[yKey]) || 0));
  }
  const seriesKeys = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxSeries).map(([k]) => k);
  const keep = new Set(seriesKeys);
  const byX = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const s = String(r[seriesKey] ?? '');
    if (!keep.has(s)) continue;
    const xv = String(r[xKey] ?? '');
    let row = byX.get(xv);
    if (!row) {
      row = { [xKey]: r[xKey] };
      byX.set(xv, row);
    }
    row[s] = Number(r[yKey]) || 0;
  }
  return { data: [...byX.values()], seriesKeys };
}

/** Renders an AI-chosen chart (line / bar / horizontal bar / donut) from the SQL rows. */
export function AiResultChart({
  spec,
  rows,
}: {
  spec: AiChartSpec;
  rows: Array<Record<string, unknown>>;
}) {
  // ── Multi-series: one coloured line/bar per category value ─────────────
  if (spec.series && (spec.type === 'line' || spec.type === 'bar')) {
    const { data, seriesKeys } = pivotSeries(rows, spec.x, spec.y[0], spec.series);
    return (
      <div className="mt-2" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={spec.x} tickFormatter={formatDate} tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(value: number | string) => fmtNum(value)} labelFormatter={(l) => formatDate(l)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => truncate(v, 18)} />
              {seriesKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              ))}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey={spec.x} tickFormatter={(v) => truncate(formatDate(v), 14)} tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(value: number | string) => fmtNum(value)} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(140,130,170,0.08)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => truncate(v, 18)} />
              {seriesKeys.map((k, i) => (
                <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  const data = rows.map((r) => {
    const o: Record<string, unknown> = { [spec.x]: r[spec.x] };
    for (const y of spec.y) {
      const v = r[y];
      o[y] = typeof v === 'number' ? v : Number(v ?? 0);
    }
    return o;
  });

  // ── Donut: share of a single metric across categories ──────────────────
  if (spec.type === 'pie') {
    const key = spec.y[0];
    const total = data.reduce((s, d) => s + (Number(d[key]) || 0), 0);
    return (
      <div className="mt-2" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={key}
              nameKey={spec.x}
              innerRadius={55}
              outerRadius={90}
              paddingAngle={1.5}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--card-bg)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | string, name: string) => {
                const num = Number(value) || 0;
                const pct = total > 0 ? ((num / total) * 100).toFixed(1) : '0';
                return [`${fmtNum(value)} (${pct}%)`, name];
              }}
              contentStyle={tooltipStyle}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => truncate(v, 22)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Horizontal bars: long / many category labels stay readable ─────────
  if (spec.type === 'hbar') {
    const key = spec.y[0];
    const height = Math.max(200, data.length * 34 + 24);
    return (
      <div className="mt-2" style={{ height: Math.min(height, 460) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey={spec.x}
              tick={{ fontSize: 11, fill: AXIS }}
              tickFormatter={(v) => truncate(v, 22)}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip formatter={(value: number | string) => fmtNum(value)} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(140,130,170,0.08)' }} />
            <Bar dataKey={key} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Line (trend) and vertical bar (few short-labelled categories) ──────
  const rotate = spec.type === 'bar' && data.length > 5;
  return (
    <div className="mt-2" style={{ height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        {spec.type === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey={spec.x}
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: AXIS }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} width={54} />
            <Tooltip
              formatter={(value: number | string) => fmtNum(value)}
              labelFormatter={(l) => formatDate(l)}
              contentStyle={tooltipStyle}
            />
            {spec.y.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {spec.y.map((y, i) => (
              <Line key={y} type="monotone" dataKey={y} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey={spec.x}
              tickFormatter={(v) => truncate(formatDate(v), 14)}
              tick={{ fontSize: 10, fill: AXIS }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={rotate ? -20 : 0}
              textAnchor={rotate ? 'end' : 'middle'}
              height={rotate ? 54 : 30}
            />
            <YAxis tick={{ fontSize: 10, fill: AXIS }} axisLine={false} tickLine={false} width={54} />
            <Tooltip formatter={(value: number | string) => fmtNum(value)} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(140,130,170,0.08)' }} />
            {spec.y.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {spec.y.map((y, i) => (
              <Bar key={y} dataKey={y} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {spec.y.length === 1 &&
                  data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Bar>
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
