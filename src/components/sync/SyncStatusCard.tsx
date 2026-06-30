import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { formatRelativeTime } from '@/lib/format';
import type { ConnectionStatusDTO } from '@/lib/types';

interface SyncStatusCardProps {
  status: ConnectionStatusDTO;
  title: string;
  icon: string;             // Bootstrap Icons class, e.g. 'bi-google'
  iconBg?: string;          // CSS colour for icon background
  iconColor?: string;       // CSS colour for icon
  children?: ReactNode;
}

export function SyncStatusCard({
  status,
  title,
  icon,
  iconBg = 'rgba(0,217,208,0.12)',
  iconColor = '#00a8a2',
  children,
}: SyncStatusCardProps) {
  const pillClass = status.configured
    ? status.connected
      ? 'status-live'
      : 'status-paused'
    : 'status-removed';
  const stateLabel = status.configured
    ? status.connected
      ? 'Connected'
      : 'Not synced yet'
    : 'Not configured';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
            style={{ background: iconBg, color: iconColor }}
          >
            <i className={`bi ${icon}`} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="ice-section-title text-base">{title}</h2>
              <span className={`status-pill ${pillClass}`}>{stateLabel}</span>
            </div>
            <p className="mt-1 max-w-lg text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {status.message}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>
                <i className="bi bi-check-circle mr-1" style={{ color: 'var(--green)' }} aria-hidden="true" />
                Last success:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {status.lastSuccessAt ? formatRelativeTime(status.lastSuccessAt) : 'never'}
                </strong>
              </span>
              <span>
                <i className="bi bi-x-circle mr-1" style={{ color: 'var(--red)' }} aria-hidden="true" />
                Last failure:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {status.lastFailureAt ? formatRelativeTime(status.lastFailureAt) : 'none'}
                </strong>
              </span>
            </div>
          </div>
        </div>
        {children && <div>{children}</div>}
      </div>
    </Card>
  );
}
