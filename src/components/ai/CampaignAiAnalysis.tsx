'use client';

import { useState } from 'react';
import { analyzeCampaignAi } from '@/lib/api-client';
import { formatNumber, formatUsd } from '@/lib/format';
import type { AiCampaignAnalysis } from '@/lib/types';
import { useAiStatus } from './AiStatusProvider';

export function CampaignAiAnalysis({
  campaignId,
  from,
  to,
}: {
  campaignId: number;
  from: string;
  to: string;
}) {
  const { configured, refresh } = useAiStatus();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiCampaignAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await analyzeCampaignAi(campaignId, { from, to });
      setResult(r);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--ai-bg)', border: '1px solid var(--ai-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--section-heading)' }}>
          <i className="bi bi-stars" style={{ color: 'var(--violet)' }} aria-hidden="true" /> AI analysis
        </span>
        <button onClick={run} disabled={loading} className="ice-pill-btn-ghost" type="button">
          {loading ? (
            <>
              <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Analysing…
            </>
          ) : (
            <>{result ? 'Regenerate' : 'Explain with AI'}</>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      {result && (
        <div className="mt-2">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--section-heading)' }}>
            {result.summary}
          </p>
          {result.strengths.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  <i className="bi bi-check-circle-fill mt-0.5" style={{ color: 'var(--green)' }} aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          )}
          {result.suggestion && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <i className="bi bi-lightbulb mt-0.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
              {result.suggestion}
            </p>
          )}
          <div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            AI · {result.model} · {formatNumber(result.usage.totalTokens)} tokens ·{' '}
            {formatUsd(result.usage.estimatedCostUsd)}
          </div>
        </div>
      )}
    </div>
  );
}
