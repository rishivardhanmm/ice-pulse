'use client';

/** A single entity's metrics shown as labelled cards (used for "deep dive" answers). */

function prettyLabel(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\bctr\b/i, 'CTR')
    .replace(/\bcpc\b/i, 'CPC')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetric(col: string, v: unknown): string {
  const n = Number(v);
  if (v == null || v === '' || Number.isNaN(n)) return String(v ?? '—');
  const k = col.toLowerCase();
  if (/(ctr|rate|percent)/.test(k)) return `${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`;
  if (/(cost|spend|cpc|cpa|revenue|value|budget)/.test(k)) {
    return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}

function isNumeric(v: unknown): boolean {
  return v != null && v !== '' && !Number.isNaN(Number(v));
}

export function AiStatGrid({ columns, row }: { columns: string[]; row: Record<string, unknown> }) {
  // First non-numeric text column is the entity name → use it as a heading.
  const titleCol = columns.find((c) => typeof row[c] === 'string' && !isNumeric(row[c]));
  const metricCols = columns.filter((c) => c !== titleCol);

  return (
    <div>
      {titleCol && (
        <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--section-heading)' }}>
          {String(row[titleCol])}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {metricCols.map((c) => (
          <div
            key={c}
            className="rounded-lg px-3 py-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {prettyLabel(c)}
            </div>
            <div className="text-base font-semibold" style={{ color: 'var(--section-heading)' }}>
              {formatMetric(c, row[c])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
