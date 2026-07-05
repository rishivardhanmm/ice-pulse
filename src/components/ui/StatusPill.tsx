function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/(^|\s)\w/g, (m) => m.toUpperCase())
    .trim();
}

const CAMPAIGN: Record<string, { cls: string; label: string }> = {
  ENABLED: { cls: 'status-live', label: 'Enabled' },
  ACTIVE: { cls: 'status-live', label: 'Active' },
  PAUSED: { cls: 'status-paused', label: 'Paused' },
  REMOVED: { cls: 'status-removed', label: 'Removed' },
  ARCHIVED: { cls: 'status-neutral', label: 'Archived' },
  DELETED: { cls: 'status-removed', label: 'Deleted' },
  WITH_ISSUES: { cls: 'status-paused', label: 'With issues' },
};

export function CampaignStatusPill({ status }: { status: string | null }) {
  const key = (status ?? '').toUpperCase();
  const m = CAMPAIGN[key] ?? {
    cls: 'status-neutral',
    label: status ? titleCase(status) : 'Unknown',
  };
  return <span className={`status-pill ${m.cls}`}>{m.label}</span>;
}

const SYNC: Record<string, { cls: string; label: string; icon: string }> = {
  success: { cls: 'status-live', label: 'Success', icon: 'bi-check-circle-fill' },
  failed: { cls: 'status-removed', label: 'Failed', icon: 'bi-x-circle-fill' },
  running: { cls: 'status-neutral', label: 'Running', icon: 'bi-arrow-repeat' },
};

export function SyncStatusPill({ status }: { status: string }) {
  const m = SYNC[status] ?? { cls: 'status-neutral', label: titleCase(status), icon: 'bi-dot' };
  return (
    <span className={`status-pill ${m.cls}`}>
      <i className={`bi ${m.icon}`} aria-hidden="true" />
      {m.label}
    </span>
  );
}

const APPROVAL: Record<string, { cls: string; label: string; icon: string }> = {
  pending: { cls: 'status-paused', label: 'Pending', icon: 'bi-hourglass-split' },
  approved: { cls: 'status-live', label: 'Approved', icon: 'bi-check-circle-fill' },
  rejected: { cls: 'status-removed', label: 'Rejected', icon: 'bi-x-circle-fill' },
};

export function ApprovalStatusPill({ status }: { status: string }) {
  const m = APPROVAL[status] ?? { cls: 'status-neutral', label: titleCase(status), icon: 'bi-dot' };
  return (
    <span className={`status-pill ${m.cls}`}>
      <i className={`bi ${m.icon}`} aria-hidden="true" />
      {m.label}
    </span>
  );
}
