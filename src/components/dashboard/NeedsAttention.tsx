'use client';

import { signalsUrl } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import type { Signal, SignalsDTO } from '@/lib/types';

const STYLE: Record<Signal['severity'], { color: string; icon: string }> = {
  warning: { color: 'var(--orange)', icon: 'bi-exclamation-triangle-fill' },
  info: { color: 'var(--violet)', icon: 'bi-info-circle-fill' },
  positive: { color: 'var(--green)', icon: 'bi-check-circle-fill' },
};

export function NeedsAttention({ from, to }: { from: string; to: string }) {
  const { data } = useFetch<SignalsDTO>(signalsUrl(from, to));
  if (!data || data.signals.length === 0) return null;

  return (
    <div>
      <h2 className="ice-section-title mb-3 text-base">Needs attention</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.signals.map((s) => {
          const st = STYLE[s.severity];
          return (
            <div key={s.id} className="ice-card p-4" style={{ borderLeft: `3px solid ${st.color}` }}>
              <div className="mb-1 flex items-start gap-2">
                <i className={`bi ${st.icon} mt-0.5`} style={{ color: st.color }} aria-hidden="true" />
                <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--section-heading)' }}>
                  {s.title}
                </p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {s.detail}
              </p>
              {s.action && (
                <p className="mt-2 flex items-start gap-1 text-[11px] font-medium" style={{ color: st.color }}>
                  <i className="bi bi-arrow-right-short" aria-hidden="true" />
                  {s.action}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
