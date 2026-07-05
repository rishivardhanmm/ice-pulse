export type RoadmapStatus = 'live' | 'needs_setup' | 'planned' | 'retired';

export interface RoadmapModule {
  icon: string;
  name: string;
  description: string;
  phase: string;
  color: string;
  status: RoadmapStatus;
}

const STATUS_META: Record<
  RoadmapStatus,
  { pillCls: string; label: string; icon: string; noteColor: string }
> = {
  live: { pillCls: 'status-live', label: 'Live', icon: 'bi-check-circle-fill', noteColor: 'var(--status-live-text)' },
  needs_setup: {
    pillCls: 'status-paused',
    label: 'Needs setup',
    icon: 'bi-exclamation-triangle-fill',
    noteColor: 'var(--status-paused-text)',
  },
  planned: { pillCls: 'status-neutral', label: 'Planned', icon: 'bi-lock', noteColor: 'var(--text-muted)' },
  retired: { pillCls: 'status-neutral', label: 'Retired', icon: 'bi-x-circle', noteColor: 'var(--text-muted)' },
};

export function RoadmapModuleCard({ module }: { module: RoadmapModule }) {
  const meta = STATUS_META[module.status];
  return (
    <div className="ice-card relative overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
          style={{ background: `color-mix(in srgb, ${module.color} 16%, transparent)`, color: module.color }}
        >
          <i className={`bi ${module.icon}`} aria-hidden="true" />
        </div>
        <span className={`status-pill ${meta.pillCls}`}>{module.phase}</span>
      </div>
      <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--section-heading)' }}>
        {module.name}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {module.description}
      </p>
      <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: meta.noteColor }}>
        <i className={`bi ${meta.icon}`} aria-hidden="true" /> {meta.label}
      </div>
    </div>
  );
}
