'use client';

import { useEffect, useRef, useState } from 'react';
import { askAiQuestion } from '@/lib/api-client';
import type { AiAskResult } from '@/lib/types';
import { useAiStatus } from './AiStatusProvider';
import { AiResultChart } from './AiResultChart';
import { AiStatGrid } from './AiStatGrid';
import { AiSmallMultiples } from './AiSmallMultiples';

interface UserTurn {
  role: 'user';
  content: string;
}
interface AssistantTurn {
  role: 'assistant';
  result: AiAskResult;
}
type Turn = UserTurn | AssistantTurn;

const EXAMPLES = [
  'Which campaigns are wasting spend?',
  'Show me the daily spend trend',
  'Spend share by campaign',
  'Which campaign has the best CTR?',
];

function AssistantBubble({ result }: { result: AiAskResult }) {
  const { display, rows, columns } = result;
  const showChart = display.kind === 'chart' && display.chart && rows.length > 0;
  const showStats = display.kind === 'stats' && rows.length > 0;
  const showMultiples = display.kind === 'multiples' && rows.length > 0;
  return (
    <div className="space-y-2">
      <div
        className="rounded-lg px-3 py-2 text-sm leading-relaxed"
        style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
      >
        {result.answer}
      </div>
      {showChart && display.chart && (
        <div className="ice-card p-3">
          <AiResultChart spec={display.chart} rows={rows} />
        </div>
      )}
      {showStats && (
        <div className="ice-card p-3">
          <AiStatGrid columns={columns} row={rows[0]} />
        </div>
      )}
      {showMultiples && (
        <div className="ice-card p-3">
          <AiSmallMultiples columns={columns} rows={rows} />
        </div>
      )}
    </div>
  );
}

export function AssistantChat({
  from,
  to,
  initialQuestion,
}: {
  from: string;
  to: string;
  initialQuestion?: string;
}) {
  const { refresh } = useAiStatus();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const sentInitial = useRef(false);
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loadingRef.current) return;
    loadingRef.current = true;
    setError(null);
    const history = turnsRef.current.slice(-6).map((t) => ({
      role: t.role,
      content: t.role === 'user' ? t.content : t.result.answer,
    }));
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const result = await askAiQuestion({ question: q, from, to, history });
      setTurns((t) => [...t, { role: 'assistant', result }]);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const send = () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    void ask(q);
  };

  // Auto-send a pre-filled question (from the dashboard bar / suggestion chips).
  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  return (
    <div className="flex h-full flex-col">
      <div className="ice-scroll flex-1 space-y-4 overflow-y-auto pr-1">
        {turns.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'linear-gradient(135deg, var(--gold), var(--cerise))', color: '#14082a' }}
            >
              <i className="bi bi-stars" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold" style={{ color: 'var(--section-heading)' }}>
              Ask anything about your campaigns
            </p>
            <p className="max-w-md text-xs" style={{ color: 'var(--text-muted)' }}>
              Answers are computed by querying your database and shown as a clear chart.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => ask(ex)}
                  className="rounded-full px-3 py-1.5 text-xs transition-colors"
                  style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div
              key={i}
              className="ml-auto max-w-[80%] rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-hover)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}
            >
              {t.content}
            </div>
          ) : (
            <AssistantBubble key={i} result={t.result} />
          ),
        )}
        {loading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-arrow-repeat animate-spin" style={{ color: 'var(--gold)' }} aria-hidden="true" />
            Querying the database…
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Ask a question…"
          aria-label="Ask a question about your campaigns"
          className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: 'var(--search-bg)', border: '1px solid var(--search-border)', color: 'var(--search-text)' }}
        />
        <button onClick={send} disabled={loading || !input.trim()} className="ice-pill-btn-gold" type="button" aria-label="Send">
          <i className="bi bi-send" aria-hidden="true" /> Ask
        </button>
      </div>
    </div>
  );
}
