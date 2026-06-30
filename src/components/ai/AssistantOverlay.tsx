'use client';

import { useEffect, useState } from 'react';
import { defaultRange, todayUtc } from '@/lib/date';
import { AssistantChat } from './AssistantChat';

function DateInput({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      aria-label={label}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="rounded-lg px-2 py-1.5 text-xs outline-none"
      style={{ background: 'var(--search-bg)', border: '1px solid var(--search-border)', color: 'var(--search-text)', colorScheme: 'light' }}
    />
  );
}

export function AssistantOverlay({
  onClose,
  initialQuestion,
}: {
  onClose: () => void;
  initialQuestion?: string;
}) {
  const def = defaultRange(365);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
                Answers query your database — grounded in real data.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 sm:flex">
              <DateInput value={from} max={to} onChange={setFrom} label="From date" />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <DateInput value={to} min={from} max={todayUtc()} onChange={setTo} label="To date" />
            </div>
            <button onClick={onClose} className="ice-icon-btn" aria-label="Close assistant" type="button">
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-hidden p-4">
        <AssistantChat from={from} to={to} initialQuestion={initialQuestion} />
      </div>
    </div>
  );
}
