import type { ReactNode } from 'react';

type Accent = 'gold' | 'teal' | 'violet' | 'cerise' | 'green' | 'orange';

const ICON_STYLE: Record<Accent, { bg: string; color: string }> = {
  gold: { bg: 'rgba(255,213,0,0.15)', color: '#b89600' },
  teal: { bg: 'rgba(0,217,208,0.12)', color: '#00a8a2' },
  violet: { bg: 'rgba(199,157,254,0.15)', color: '#8b5cf6' },
  cerise: { bg: 'rgba(255,134,239,0.12)', color: '#d946ef' },
  green: { bg: 'rgba(34,211,160,0.12)', color: '#059669' },
  orange: { bg: 'rgba(255,157,77,0.15)', color: '#c2410c' },
};

export function KpiCard({
  accent,
  icon,
  label,
  value,
  delta,
}: {
  accent: Accent;
  icon: string;
  label: string;
  value: string;
  delta?: ReactNode;
}) {
  const iconStyle = ICON_STYLE[accent];
  return (
    <div
      className={`ice-card ice-card-interactive kpi-accent-${accent} p-4`}
      style={{ background: 'var(--kpi-card-bg)' }}
    >
      <div
        className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-[15px]"
        style={{ background: iconStyle.bg, color: iconStyle.color }}
      >
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <p
        className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--kpi-label-color)' }}
      >
        {label}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <span
          className="font-display text-2xl font-extrabold leading-none"
          style={{ color: 'var(--kpi-card-text)' }}
        >
          {value}
        </span>
        {delta}
      </div>
    </div>
  );
}
