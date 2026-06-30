export interface RoadmapModule {
  icon: string;
  name: string;
  description: string;
  phase: string;
  color: string;
  live?: boolean;
}

export function RoadmapModuleCard({ module }: { module: RoadmapModule }) {
  return (
    <div className="ice-card relative overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
          style={{ background: `color-mix(in srgb, ${module.color} 16%, transparent)`, color: module.color }}
        >
          <i className={`bi ${module.icon}`} aria-hidden="true" />
        </div>
        <span className={`status-pill ${module.live ? 'status-live' : 'status-neutral'}`}>{module.phase}</span>
      </div>
      <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--section-heading)' }}>
        {module.name}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {module.description}
      </p>
      {module.live ? (
        <div
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: 'var(--status-live-text)' }}
        >
          <i className="bi bi-check-circle-fill" aria-hidden="true" /> Available now
        </div>
      ) : (
        <div
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          <i className="bi bi-lock" aria-hidden="true" /> Coming later
        </div>
      )}
    </div>
  );
}
