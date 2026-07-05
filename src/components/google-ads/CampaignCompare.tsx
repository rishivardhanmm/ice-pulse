'use client';

import { useState } from 'react';
import type { CampaignDTO } from '@/lib/types';

interface CompareResult {
  headline: string;
  summary: string;
  differences: string[];
  recommendation: string;
  error?: string;
}

const SELECT_STYLE: React.CSSProperties = {
  background: 'var(--search-bg)',
  border: '1px solid var(--search-border)',
  color: 'var(--search-text)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 12,
  outline: 'none',
  maxWidth: 260,
};

/** "Compare campaigns" button + modal: pick two campaigns, get an AI verdict. */
export function CampaignCompare({
  campaigns,
  from,
  to,
}: {
  campaigns: CampaignDTO[];
  from: string;
  to: string;
}) {
  const [open, setOpen] = useState(false);
  const [idA, setIdA] = useState<number | ''>('');
  const [idB, setIdB] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);

  if (campaigns.length < 2) return null;

  async function run() {
    if (!idA || !idB || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/ai/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignIdA: idA, campaignIdB: idB, from, to }),
      });
      const body = (await res.json()) as CompareResult;
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ice-pill-btn-ghost"
      >
        <i className="bi bi-arrow-left-right" aria-hidden="true" /> Compare campaigns
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(20,8,42,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="ice-scroll max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-pop)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                <i className="bi bi-stars mr-1.5" style={{ color: 'var(--violet)' }} aria-hidden="true" />
                AI campaign comparison
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="ice-icon-btn h-8 w-8" aria-label="Close">
                <i className="bi bi-x-lg text-sm" aria-hidden="true" />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <select
                value={idA}
                onChange={(e) => setIdA(e.target.value ? Number(e.target.value) : '')}
                style={SELECT_STYLE}
                aria-label="First campaign"
              >
                <option value="">First campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === idB}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span style={{ color: 'var(--text-muted)' }}>vs</span>
              <select
                value={idB}
                onChange={(e) => setIdB(e.target.value ? Number(e.target.value) : '')}
                style={SELECT_STYLE}
                aria-label="Second campaign"
              >
                <option value="">Second campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === idA}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void run()}
                disabled={!idA || !idB || loading}
                className="ice-pill-btn-gold"
              >
                {loading ? (
                  <>
                    <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Comparing…
                  </>
                ) : (
                  'Compare'
                )}
              </button>
            </div>

            {error && (
              <p className="mb-3 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>
                {error}
              </p>
            )}

            {result && (
              <div>
                <h4 className="ice-section-title mb-2 text-sm">{result.headline}</h4>
                <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {result.summary}
                </p>
                {result.differences.length > 0 && (
                  <ul className="mb-3 space-y-1.5">
                    {result.differences.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                        <i className="bi bi-arrow-left-right mt-0.5 text-[11px]" style={{ color: 'var(--violet)' }} aria-hidden="true" />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
                {result.recommendation && (
                  <p
                    className="rounded-xl px-3 py-2.5 text-[13px] font-medium"
                    style={{ background: 'var(--ai-bg)', border: '1px solid var(--ai-border)', color: 'var(--text-primary)' }}
                  >
                    <i className="bi bi-lightbulb-fill mr-1.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
                    {result.recommendation}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
