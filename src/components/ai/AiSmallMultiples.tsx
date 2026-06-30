'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#FFD500', '#00D9D0', '#C79DFE', '#FF86EF', '#22D3A0', '#FF9D4D', '#5B8DEF', '#F2545B'];

function formatDate(v: unknown): string {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  return s;
}

function prettyLabel(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\bctr\b/i, 'CTR')
    .replace(/\bcpc\b/i, 'CPC')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtNum(v: number | string): string {
  return typeof v === 'number' ? v.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : v;
}

function isNumericCol(rows: Array<Record<string, unknown>>, col: string): boolean {
  return rows.length > 0 && rows.every((r) => r[col] != null && r[col] !== '' && !Number.isNaN(Number(r[col])));
}

/**
 * A grid of compact trend charts — one per metric — for showing several
 * mixed-scale metrics over time (where a single shared y-axis would be useless).
 */
export function AiSmallMultiples({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}) {
  const xCol = columns.find((c) => /date|day|month|week/i.test(c)) ?? columns[0];
  const metricCols = columns.filter((c) => c !== xCol && isNumericCol(rows, c)).slice(0, 6);

  if (metricCols.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {metricCols.map((metric, i) => {
        const data = rows.map((r) => ({ x: r[xCol], v: Number(r[metric]) || 0 }));
        return (
          <div
            key={metric}
            className="rounded-lg p-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}
          >
            <div className="mb-1 px-1 text-[11px] font-semibold" style={{ color: 'var(--section-heading)' }}>
              {prettyLabel(metric)}
            </div>
            <div style={{ height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="x"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 9, fill: '#8b7fb0' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(value: number | string) => [fmtNum(value), prettyLabel(metric)] as [string, string]}
                    labelFormatter={(l) => formatDate(l)}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border-strong)' }}
                  />
                  <Line type="monotone" dataKey="v" stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
