'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  formatCompactNumber,
  formatCurrency,
  formatNumber,
  formatRelativeTime,
} from '@/lib/format';
import type { DashboardOverviewDTO } from '@/lib/types';

interface PulseMessage {
  icon: string;
  text: string;
}

function buildMessages(overview: DashboardOverviewDTO): PulseMessage[] {
  const messages: PulseMessage[] = [];
  const { lastSyncedAt, summary, insights, currency } = overview;

  if (lastSyncedAt) {
    messages.push({
      icon: 'bi-clock-history',
      text: `Google Ads data was last synced ${formatRelativeTime(lastSyncedAt)}.`,
    });
  } else {
    messages.push({
      icon: 'bi-cloud-arrow-down',
      text: 'No Google Ads sync yet — run your first sync from the Sync Centre.',
    });
  }

  const bestCtr = insights.find((i) => i.id === 'best-ctr');
  if (bestCtr) {
    messages.push({ icon: 'bi-graph-up-arrow', text: `${bestCtr.value} has your strongest CTR right now.` });
  }

  const highSpend = insights.find((i) => i.id === 'highest-spend');
  if (highSpend && summary.spend > 0) {
    messages.push({
      icon: 'bi-cash-stack',
      text: `${formatCurrency(summary.spend, currency)} spent so far — ${highSpend.value} leads on spend.`,
    });
  }

  if (summary.conversions <= 0) {
    messages.push({
      icon: 'bi-bullseye',
      text: 'No conversions tracked for this period yet — check conversion tracking in Google Ads.',
    });
  }

  messages.push({ icon: 'bi-meta', text: "No Meta connection yet — it's on the roadmap." });
  messages.push({
    icon: 'bi-database-add',
    text: 'Your campaign results database can be connected in a later phase.',
  });

  return messages;
}

export function PulseAssistant({ overview }: { overview: DashboardOverviewDTO }) {
  const messages = useMemo(() => buildMessages(overview), [overview]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % messages.length), 5000);
    return () => clearInterval(timer);
  }, [messages.length]);

  const message = messages[idx % messages.length] ?? messages[0];
  const { summary, currency } = overview;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5"
      style={{ background: 'var(--ai-bg)', border: '1px solid var(--ai-border)' }}
    >
      <div className="flex items-start gap-4">
        {/* Animated orb */}
        <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center">
          <span
            className="absolute inline-flex h-12 w-12 rounded-full opacity-40 animate-pulseDot"
            style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
          />
          <span
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-[18px]"
            style={{ background: 'linear-gradient(135deg, var(--gold), var(--cerise))', color: '#14082a' }}
          >
            <i className="bi bi-soundwave" aria-hidden="true" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="text-[9px] font-bold uppercase tracking-[1.5px]"
              style={{ color: 'var(--gold)' }}
            >
              Pulse Assistant
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide"
              style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
            >
              Rule-based · not AI
            </span>
          </div>
          <p
            key={idx}
            className="min-h-[40px] animate-fadeIn text-sm leading-relaxed"
            style={{ color: 'var(--section-heading)' }}
          >
            <i className={`bi ${message.icon} mr-1.5`} style={{ color: 'var(--gold)' }} aria-hidden="true" />
            {message.text}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <MiniStat label="Spend" value={formatCurrency(summary.spend, currency)} />
            <MiniStat label="Clicks" value={formatCompactNumber(summary.clicks)} />
            <MiniStat label="Conversions" value={formatNumber(summary.conversions)} />
          </div>

          {messages.length > 1 && (
            <div className="mt-3 flex gap-1.5">
              {messages.map((_, i) => (
                <span
                  key={i}
                  className="h-1 rounded-full transition-all"
                  style={{
                    width: i === idx % messages.length ? 16 : 6,
                    background: i === idx % messages.length ? 'var(--gold)' : 'var(--border-strong)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg px-2.5 py-1.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}
    >
      <div className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-xs font-semibold" style={{ color: 'var(--section-heading)' }}>
        {value}
      </div>
    </div>
  );
}
