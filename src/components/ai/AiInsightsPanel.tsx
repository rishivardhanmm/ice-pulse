'use client';

import { useState } from 'react';
import { generateAiInsights } from '@/lib/api-client';
import { formatNumber, formatUsd } from '@/lib/format';
import type { AiInsightsResult } from '@/lib/types';
import { useAiStatus } from './AiStatusProvider';

export function AiInsightsPanel({ from, to }: { from: string; to: string }) {
  const { configured, model, refresh } = useAiStatus();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiInsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await generateAiInsights({ from, to });
      setResult(r);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--ai-bg)', border: '1px solid var(--ai-border)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-base"
            style={{ background: 'linear-gradient(135deg, var(--gold), var(--cerise))', color: '#14082a' }}
          >
            <i className="bi bi-stars" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[1.5px]" style={{ color: 'var(--violet)' }}>
              AI insights
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Powered by {model} · runs on demand
            </p>
          </div>
        </div>
        <button onClick={run} disabled={loading} className="ice-pill-btn-gold" type="button">
          {loading ? (
            <>
              <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Generating…
            </>
          ) : (
            <>
              <i className="bi bi-stars" aria-hidden="true" /> {result ? 'Regenerate' : 'Generate AI insights'}
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--section-heading)' }}>
            {result.summary}
          </p>
          {result.recommendations.length > 0 && (
            <ul className="mt-3 space-y-2">
              {result.recommendations.map((rec, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <i className="bi bi-lightbulb mt-0.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
                  {rec}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            AI · {result.model} · {formatNumber(result.usage.totalTokens)} tokens ·{' '}
            {formatUsd(result.usage.estimatedCostUsd)}
          </div>
        </div>
      )}

      {!result && !error && (
        <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Get a short AI summary and 2–4 recommendations for the selected date range.
        </p>
      )}
    </div>
  );
}
