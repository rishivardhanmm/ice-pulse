import { SyncStatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import type { SyncRunDTO } from '@/lib/types';

const RIGHT = { textAlign: 'right' as const };

export function SyncHistoryTable({ runs }: { runs: SyncRunDTO[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon="bi-clock-history"
        title="No sync runs yet"
        description="Trigger a sync above (or run npm run sync:google-ads) and the run history will appear here."
      />
    );
  }

  return (
    <div className="ice-scroll overflow-x-auto">
      <table className="ice-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Source</th>
            <th>Started</th>
            <th style={RIGHT}>Duration</th>
            <th style={RIGHT}>Processed</th>
            <th style={RIGHT}>New</th>
            <th style={RIGHT}>Updated</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>
                <SyncStatusPill status={run.status} />
              </td>
              <td className="ice-table-strong">{run.source}</td>
              <td>{formatDateTime(run.startedAt)}</td>
              <td style={RIGHT}>{formatDuration(run.durationMs)}</td>
              <td style={RIGHT}>{formatNumber(run.recordsProcessed)}</td>
              <td style={RIGHT}>{formatNumber(run.recordsInserted)}</td>
              <td style={RIGHT}>{formatNumber(run.recordsUpdated)}</td>
              <td className="max-w-[280px] truncate" title={run.errorMessage ?? ''} style={{ color: run.errorMessage ? 'var(--red)' : 'var(--text-muted)' }}>
                {run.errorMessage ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
