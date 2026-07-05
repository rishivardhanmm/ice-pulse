'use client';

import { useState } from 'react';

/** Simple budget utilisation gauge shown on the client dashboard. */
export function ClientBudgetGauge({
  pctUsed,
  updatedAt,
  size = 'md',
}: {
  pctUsed: number;
  updatedAt: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const clamped = Math.min(Math.max(pctUsed, 0), 100);
  const color =
    clamped >= 90 ? 'var(--red)' : clamped >= 70 ? 'var(--gold)' : 'var(--green)';

  const labelSize = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-lg';
  const barH = size === 'sm' ? 'h-2' : 'h-3';

  return (
    <div className="w-full">
      <div className={`mb-1 font-display font-extrabold tabular-nums ${labelSize}`} style={{ color }}>
        {clamped}
        <span className="text-[0.5em] font-bold">%</span>
        <span className="ml-2 text-xs font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.45em' }}>
          budget used
        </span>
      </div>

      <div className={`relative w-full overflow-hidden rounded-full ${barH}`} style={{ background: 'var(--surface-2)' }}>
        <div
          className={`${barH} rounded-full transition-all duration-700`}
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>

      {updatedAt && (
        <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Set {new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

/** Inline editor for ICE staff to set a client&apos;s budget % and monthly amount. */
export function ClientBudgetEditor({
  clientId,
  current,
  onSaved,
}: {
  clientId: number;
  current: {
    pctUsed: number;
    updatedAt: string | null;
    monthlyBudget?: number | null;
    monthlyConversionGoal?: number | null;
  } | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<string>(current ? String(current.pctUsed) : '');
  const [amount, setAmount] = useState<string>(
    current?.monthlyBudget != null ? String(current.monthlyBudget) : '',
  );
  const [goal, setGoal] = useState<string>(
    current?.monthlyConversionGoal != null ? String(current.monthlyConversionGoal) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0 || n > 100) {
      setError('Enter a value between 0 and 100.');
      return;
    }
    const amt = amount.trim() === '' ? null : Number(amount);
    if (amt !== null && (!Number.isFinite(amt) || amt <= 0)) {
      setError('Monthly budget must be a positive amount (or leave it blank).');
      return;
    }
    const goalNum = goal.trim() === '' ? null : Number(goal);
    if (goalNum !== null && (!Number.isFinite(goalNum) || goalNum <= 0)) {
      setError('Conversion goal must be a positive number (or leave it blank).');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/budget`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pctUsed: n, monthlyBudget: amt, monthlyConversionGoal: goalNum }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) { setError(json?.error ?? 'Save failed.'); return; }
      onSaved();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const pct = parseInt(value, 10);
  const preview = !isNaN(pct) && pct >= 0 && pct <= 100 ? pct : null;

  return (
    <div className="space-y-3">
      {preview !== null && (
        <ClientBudgetGauge pctUsed={preview} updatedAt={null} size="md" />
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            className="ice-search w-full pr-8 text-sm"
            placeholder="0–100"
          />
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            %
          </span>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving || value === ''}
          className="ice-pill-btn-gold py-1.5 text-xs disabled:opacity-60"
        >
          {saving ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Save'}
        </button>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          Monthly budget amount (optional — enables live budget pacing on the client&apos;s dashboard)
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            £
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            className="ice-search w-full pl-7 text-sm"
            placeholder="e.g. 5000 — leave blank to keep the manual % gauge"
          />
        </div>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          When set, the client sees real spend vs this amount, the daily pace, and a projected month-end
          figure — computed automatically from their campaign data.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          Monthly conversion goal (optional — shows goal progress on the client&apos;s dashboard)
        </label>
        <input
          type="number"
          min={0}
          step="1"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          className="ice-search w-full text-sm"
          placeholder="e.g. 50 conversions per month"
        />
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

      {current && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Currently <strong>{current.pctUsed}%</strong>
          {current.updatedAt
            ? ` · Updated ${new Date(current.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : ''}
        </p>
      )}
    </div>
  );
}
