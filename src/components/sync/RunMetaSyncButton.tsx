'use client';

import { useState } from 'react';
import { triggerMetaAdsSync } from '@/lib/api-client';
import type { SyncResultDTO } from '@/lib/types';

function InlineNote({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  const color = tone === 'success' ? 'var(--green)' : 'var(--red)';
  const icon = tone === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
      style={{ background: 'color-mix(in srgb, ' + color + ' 12%, transparent)', color }}
    >
      <i className={`bi ${icon} mt-0.5`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function RunMetaSyncButton({
  from,
  to,
  onComplete,
}: {
  from: string;
  to: string;
  onComplete: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SyncResultDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const r = await triggerMetaAdsSync({ from, to });
      setResult(r);
      if (r.status === 'failed') setError(r.errorMessage);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync request failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:min-w-[260px]">
      <button onClick={run} disabled={pending} className="ice-pill-btn-gold justify-center" type="button">
        {pending ? (
          <>
            <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Syncing…
          </>
        ) : (
          <>
            <i className="bi bi-arrow-repeat" aria-hidden="true" /> Run Meta Ads sync
          </>
        )}
      </button>
      <p className="text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
        Pulls {from} → {to}
      </p>
      {result && result.status === 'success' && (
        <InlineNote tone="success">
          Synced {result.recordsProcessed} rows — {result.recordsInserted} new,{' '}
          {result.recordsUpdated} updated.
        </InlineNote>
      )}
      {error && <InlineNote tone="error">{error}</InlineNote>}
    </div>
  );
}
