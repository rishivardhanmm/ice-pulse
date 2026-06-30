import { formatRelativeTime } from '@/lib/format';

export function LastSyncBadge({
  lastSyncedAt,
}: {
  lastSyncedAt: string | null;
}) {
  const synced = Boolean(lastSyncedAt);
  const color = synced ? 'var(--green)' : 'var(--text-muted)';
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
      style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {synced && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulseDot"
            style={{ background: color }}
          />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>
        {synced ? (
          <>
            Last synced{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatRelativeTime(lastSyncedAt)}
            </strong>
          </>
        ) : (
          'No sync yet'
        )}
      </span>
    </div>
  );
}
