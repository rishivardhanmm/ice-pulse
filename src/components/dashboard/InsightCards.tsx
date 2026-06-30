import type { InsightDTO, InsightTone } from '@/lib/types';

const TONE: Record<InsightTone, { color: string; icon: string }> = {
  positive: { color: 'var(--green)', icon: 'bi-graph-up-arrow' },
  warning: { color: 'var(--orange)', icon: 'bi-exclamation-circle-fill' },
  info: { color: 'var(--violet)', icon: 'bi-info-circle-fill' },
  neutral: { color: 'var(--text-secondary)', icon: 'bi-dot' },
};

export function InsightCards({ insights }: { insights: InsightDTO[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {insights.map((insight) => {
        const tone = TONE[insight.tone];
        return (
          <div key={insight.id} className="ice-card ice-card-interactive p-5">
            <div className="mb-2 flex items-center justify-between">
              <p
                className="text-[9px] font-bold uppercase tracking-[1.5px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {insight.label}
              </p>
              <i className={`bi ${tone.icon}`} style={{ color: tone.color }} aria-hidden="true" />
            </div>
            <p
              className="mb-2 font-display text-[1.05rem] font-extrabold leading-tight"
              style={{ color: 'var(--section-heading)' }}
            >
              {insight.value}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {insight.body}
            </p>
            <div className="mt-3">
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{
                  background: 'color-mix(in srgb, currentColor 14%, transparent)',
                  color: insight.available ? tone.color : 'var(--text-muted)',
                }}
              >
                {insight.available ? 'Rule-based insight' : 'Awaiting data'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
