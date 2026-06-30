'use client';

import { useState } from 'react';
import { syncSchedulesUrl, updateSyncSchedule } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import { formatRelativeTime } from '@/lib/format';
import type { SyncScheduleDTO } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

const SOURCE_LABEL: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

const INTERVAL_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 },
];

export function AutoSyncCard() {
  const { data, loading, error, refetch } = useFetch<SyncScheduleDTO[]>(syncSchedulesUrl());

  return (
    <Card>
      <h2 className="ice-section-title mb-1 text-sm">Automated syncs</h2>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Runs automatically in the background at the interval below. Adding Meta credentials later
        activates its row here with no code changes.
      </p>

      {error && <ErrorState message={error} onRetry={refetch} />}
      {loading && !data && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      )}

      {data && (
        <div className="space-y-2">
          {data.map((s) => (
            <ScheduleRow key={s.source} schedule={s} onSaved={refetch} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ScheduleRow({ schedule, onSaved }: { schedule: SyncScheduleDTO; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function toggleEnabled() {
    setSaving(true);
    setError('');
    try {
      await updateSyncSchedule(schedule.source, { enabled: !schedule.enabled });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  async function changeInterval(intervalMinutes: number) {
    setSaving(true);
    setError('');
    try {
      await updateSyncSchedule(schedule.source, { intervalMinutes });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5"
      style={{ background: 'var(--surface-2)' }}
    >
      <button
        onClick={() => void toggleEnabled()}
        disabled={saving}
        className={`status-pill text-[10px] disabled:opacity-50 ${schedule.enabled ? 'status-live' : 'status-neutral'}`}
        title="Click to toggle"
      >
        {schedule.enabled ? 'On' : 'Off'}
      </button>

      <span className="min-w-[90px] text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        {SOURCE_LABEL[schedule.source] ?? schedule.source}
      </span>

      <select
        className="ice-search text-xs"
        style={{ width: 130 }}
        value={schedule.intervalMinutes}
        disabled={saving}
        onChange={(e) => void changeInterval(Number(e.target.value))}
      >
        {INTERVAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <span className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Last run: {schedule.lastRunAt ? formatRelativeTime(schedule.lastRunAt) : 'never'}
        {schedule.lastStatus && ` (${schedule.lastStatus})`}
      </span>

      {error && <p className="w-full text-[11px]" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  );
}
