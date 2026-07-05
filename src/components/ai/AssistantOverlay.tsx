'use client';

import { useEffect } from 'react';
import { ALL_TIME_START, todayUtc } from '@/lib/date';
import { AssistantChat } from './AssistantChat';

export function AssistantOverlay({
  onClose,
  initialQuestion,
}: {
  onClose: () => void;
  initialQuestion?: string;
}) {
  // Ask Pulse always reasons over the full synced history — no timeline to pick.
  const from = ALL_TIME_START;
  const to = todayUtc();

  // Close on Escape. Capture phase so this fires even if focus is inside a
  // native form control (e.g. a date/text input) that would otherwise consume the key first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col animate-fadeIn" style={{ background: 'var(--bg)' }}>
      <header className="border-b" style={{ borderColor: 'var(--card-border)', background: 'var(--bg-secondary)' }}>
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-base"
              style={{ background: 'linear-gradient(135deg, var(--gold), var(--cerise))', color: '#14082a' }}
            >
              <i className="bi bi-stars" aria-hidden="true" />
            </span>
            <div>
              <p className="ice-section-title text-base leading-tight">Pulse Assistant</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Answers query your database — grounded in real data, all time.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="ice-icon-btn" aria-label="Close assistant" type="button">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-hidden p-4">
        <AssistantChat from={from} to={to} initialQuestion={initialQuestion} />
      </div>
    </div>
  );
}
