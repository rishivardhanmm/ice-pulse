'use client';

import { Card } from '@/components/ui/Card';
import { formatNumber, formatUsd } from '@/lib/format';
import { useAiStatus } from './AiStatusProvider';

export function AiUsageMeter() {
  const { configured, model, usage } = useAiStatus();
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(199,157,254,0.15)', color: 'var(--violet)' }}
        >
          <i className="bi bi-stars" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="ice-section-title text-base">AI usage</h2>
            <span className={`status-pill ${configured ? 'status-live' : 'status-neutral'}`}>
              {configured ? model : 'Not configured'}
            </span>
          </div>
          {configured && usage ? (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>
                This month:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatNumber(usage.month.totalTokens)} tokens
                </strong>{' '}
                · <strong style={{ color: 'var(--text-primary)' }}>{formatUsd(usage.month.costUsd)}</strong>
              </span>
              <span>
                Today: <strong style={{ color: 'var(--text-primary)' }}>{formatNumber(usage.today.totalTokens)}</strong>
              </span>
              <span>
                All time: <strong style={{ color: 'var(--text-primary)' }}>{formatNumber(usage.allTime.totalTokens)}</strong>{' '}
                · {formatUsd(usage.allTime.costUsd)} · {formatNumber(usage.allTime.calls)} calls
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Set <code>AI_ENABLED=true</code> and <code>OPENAI_API_KEY</code> in <code>.env.local</code> to enable AI
              insights and track token usage and cost here.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
