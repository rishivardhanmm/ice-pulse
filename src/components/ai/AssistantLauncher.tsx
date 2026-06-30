'use client';

import { useEffect, useState } from 'react';
import { useAiStatus } from './AiStatusProvider';
import { useAssistant } from './AssistantProvider';

const SEEN_KEY = 'pulse-assistant-seen';

/** Floating, labelled "Ask Pulse" pill (every page) that opens the assistant. AI-gated. */
export function AssistantLauncher() {
  const { configured } = useAiStatus();
  const { openAssistant } = useAssistant();
  const [showNudge, setShowNudge] = useState(false);

  // Show a one-time nudge so first-time users notice the assistant exists.
  useEffect(() => {
    if (!configured) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setShowNudge(true);
        const t = setTimeout(() => setShowNudge(false), 9000);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage unavailable — skip the nudge */
    }
  }, [configured]);

  const dismissNudge = () => {
    setShowNudge(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!configured) return null;

  return (
    <div className="no-print fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2">
      {showNudge && (
        <div
          className="relative max-w-[240px] animate-fadeIn rounded-xl px-3 py-2.5 text-xs shadow-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--ai-border)', color: 'var(--text-primary)' }}
        >
          <button
            onClick={dismissNudge}
            type="button"
            aria-label="Dismiss"
            className="absolute right-1.5 top-1.5 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
          <p className="pr-3 font-semibold" style={{ color: 'var(--section-heading)' }}>
            👋 New: ask Pulse anything
          </p>
          <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
            “Which campaigns are wasting spend?” — get an instant answer with a chart.
          </p>
        </div>
      )}

      <button
        onClick={() => {
          dismissNudge();
          openAssistant();
        }}
        type="button"
        className="relative flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.03]"
        style={{ background: 'linear-gradient(135deg, var(--gold), var(--cerise))', color: '#14082a' }}
        aria-label="Open Pulse Assistant"
        title="Ask Pulse"
      >
        {showNudge && (
          <span
            className="absolute inset-0 -z-10 rounded-full opacity-50 animate-pulseDot"
            style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
            aria-hidden="true"
          />
        )}
        <i className="bi bi-stars text-base" aria-hidden="true" />
        Ask Pulse
      </button>
    </div>
  );
}
