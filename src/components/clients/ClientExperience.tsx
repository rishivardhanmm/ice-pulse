'use client';

/**
 * Client-dashboard experience blocks: plain-English AI narrative, computed
 * budget pacing, client-scoped anomaly feed, Ask-Pulse invitation chips and
 * a jargon-free metric glossary. All data is scoped server-side to the
 * client's own campaigns.
 */

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { formatCurrency } from '@/lib/format';
import { useAssistant } from '@/components/ai/AssistantProvider';
import { useAiStatus } from '@/components/ai/AiStatusProvider';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AnomalyDTO, BudgetPacingDTO, ClientAiSummaryDTO } from '@/lib/types';

// ── Plain-English AI narrative ────────────────────────────────────────────────

export function ClientAiSummary({ slug, from, to }: { slug: string; from: string; to: string }) {
  const { configured } = useAiStatus();
  const { data, loading, error } = useFetch<ClientAiSummaryDTO>(
    configured ? `/api/clients/${slug}/ai-summary?from=${from}&to=${to}` : null,
  );

  if (!configured || error) return null;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--ai-bg)', borderColor: 'var(--ai-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        <i className="bi bi-stars" style={{ color: 'var(--violet)' }} aria-hidden="true" />
        Your performance, in plain English
      </h2>
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}
      {!loading && data && (
        <>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.narrative}
          </p>
          {data.whatToWatch.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Worth keeping an eye on
              </p>
              <ul className="space-y-1">
                {data.whatToWatch.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    <i className="bi bi-eye mt-0.5 text-[11px]" style={{ color: 'var(--violet)' }} aria-hidden="true" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Budget pacing ─────────────────────────────────────────────────────────────

const PACING_STYLE: Record<string, { color: string; label: string; icon: string; note: string }> = {
  on_track: {
    color: 'var(--green)',
    label: 'On track',
    icon: 'bi-check-circle-fill',
    note: 'At the current pace your spend should land close to budget this month.',
  },
  over: {
    color: 'var(--red)',
    label: 'Trending over budget',
    icon: 'bi-exclamation-triangle-fill',
    note: 'At the current pace, spend is projected to finish above this month’s budget.',
  },
  under: {
    color: 'var(--orange)',
    label: 'Trending under budget',
    icon: 'bi-arrow-down-circle-fill',
    note: 'Spend is pacing below budget — there may be room to push further this month.',
  },
};

const GOAL_STYLE: Record<string, { color: string; label: string; icon: string }> = {
  achieved: { color: 'var(--green)', label: 'Goal achieved 🎉', icon: 'bi-trophy-fill' },
  on_track: { color: 'var(--green)', label: 'On track for goal', icon: 'bi-check-circle-fill' },
  behind: { color: 'var(--orange)', label: 'Behind goal pace', icon: 'bi-exclamation-circle-fill' },
};

function GoalProgress({ goal }: { goal: NonNullable<BudgetPacingDTO['conversionGoal']> }) {
  const st = GOAL_STYLE[goal.status] ?? GOAL_STYLE.on_track;
  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--card-border)' }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Monthly conversion goal
        </p>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: st.color }}>
          <i className={`bi ${st.icon}`} aria-hidden="true" />
          {st.label}
        </span>
      </div>
      <div className="mb-1.5 flex items-end justify-between">
        <span className="font-display text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {goal.achievedThisMonth}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          of {goal.goal} conversions ({goal.pctAchieved}%) · projected {goal.projectedTotal}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, goal.pctAchieved)}%`, background: st.color }}
        />
      </div>
    </div>
  );
}

export function BudgetPacingCard({ pacing, currency }: { pacing: BudgetPacingDTO; currency: string }) {
  const hasBudget = pacing.mode === 'computed' && pacing.monthlyBudget != null;
  if (!hasBudget && !pacing.conversionGoal) return null;

  // Goal-only clients still get their progress card, just without spend maths.
  if (!hasBudget && pacing.conversionGoal) {
    return (
      <Card>
        <h2 className="ice-section-title mb-1 text-sm">Your monthly goal</h2>
        <GoalProgress goal={pacing.conversionGoal} />
      </Card>
    );
  }

  const st = PACING_STYLE[pacing.status] ?? PACING_STYLE.on_track;
  const pctBar = Math.min(100, pacing.pctUsed);
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="ice-section-title text-sm">This month&apos;s budget</h2>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: st.color }}>
          <i className={`bi ${st.icon}`} aria-hidden="true" />
          {st.label}
        </span>
      </div>

      <div className="mb-1.5 flex items-end justify-between">
        <span className="font-display text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {money(pacing.spentThisMonth)}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          of {money(pacing.monthlyBudget ?? 0)} ({pacing.pctUsed}%)
        </span>
      </div>
      <div className="mb-4 h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--surface)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pctBar}%`, background: st.color }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Daily pace
          </p>
          <p className="font-display text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {money(pacing.dailyRunRate)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Projected month-end
          </p>
          <p className="font-display text-[15px] font-extrabold" style={{ color: st.color }}>
            {money(pacing.projectedSpend)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Days left
          </p>
          <p className="font-display text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {pacing.daysRemaining}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {st.note}
      </p>

      {pacing.conversionGoal && <GoalProgress goal={pacing.conversionGoal} />}
    </Card>
  );
}

// ── Client-scoped anomaly feed ────────────────────────────────────────────────

export function ClientAnomalies() {
  const { data } = useFetch<{ anomalies: AnomalyDTO[] }>('/api/ai/anomalies?days=14');
  if (!data || data.anomalies.length === 0) return null;

  return (
    <Card>
      <h2 className="ice-section-title mb-3 text-sm">Things we spotted recently</h2>
      <div className="space-y-3">
        {data.anomalies.slice(0, 4).map((a) => {
          const spike = a.direction === 'spike';
          const color = a.severity === 'high' ? 'var(--red)' : 'var(--orange)';
          return (
            <div key={a.id} className="flex items-start gap-2.5">
              <i
                className={`bi ${spike ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'} mt-0.5`}
                style={{ color }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {a.metric === 'spend' ? 'Spend' : a.metric === 'clicks' ? 'Clicks' : 'Conversions'}{' '}
                  {spike ? 'jumped' : 'dropped'} on {a.campaignName} ({a.metricDate})
                </p>
                {a.narrative && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {a.narrative}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Ask-Pulse invitation chips ────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'Which of my campaigns performed best this period?',
  'Where did my budget go this month?',
  'How does this month compare to last month?',
  'Which campaign gives me the cheapest conversions?',
];

export function AskPulseChips() {
  const { openAssistant } = useAssistant();
  const { configured } = useAiStatus();
  if (!configured) return null;

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        <i className="bi bi-chat-heart" style={{ color: 'var(--violet)' }} aria-hidden="true" />
        Ask anything about your campaigns
      </h2>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Pulse answers from your own data — in seconds, with charts. Try one:
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button key={q} type="button" onClick={() => openAssistant(q)} className="ice-action-chip">
            {q}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Plain-English metric glossary ─────────────────────────────────────────────

const GLOSSARY: Array<{ term: string; plain: string }> = [
  { term: 'Impressions', plain: 'How many times your ads were shown to people.' },
  { term: 'Clicks', plain: 'How many times someone clicked one of your ads.' },
  {
    term: 'CTR (click-through rate)',
    plain: 'Of everyone who saw an ad, the percentage who clicked it. Higher usually means the ad resonates.',
  },
  {
    term: 'Conversions',
    plain: 'The valuable actions people took after clicking — like signing up, downloading, or getting in touch.',
  },
  {
    term: 'Cost per conversion',
    plain: 'On average, how much ad spend it took to get one of those valuable actions. Lower is better.',
  },
  {
    term: 'Avg. CPC (cost per click)',
    plain: 'The average amount paid each time someone clicked an ad.',
  },
];

export function MetricGlossary() {
  const [open, setOpen] = useState(false);
  return (
    <Card padded={false}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          <i className="bi bi-question-circle" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          What do these numbers mean?
        </span>
        <i
          className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} text-xs`}
          style={{ color: 'var(--text-muted)' }}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 pb-4 sm:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {g.term}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {g.plain}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
