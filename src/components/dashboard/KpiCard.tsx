import type { ReactNode } from 'react';

type Accent = 'gold' | 'teal' | 'violet' | 'cerise' | 'green' | 'orange';

const ICON_STYLE: Record<Accent, { bg: string; color: string }> = {
  gold: { bg: 'rgba(255,213,0,0.16)', color: '#a88a00' },
  teal: { bg: 'rgba(0,217,208,0.13)', color: '#009a94' },
  violet: { bg: 'rgba(199,157,254,0.16)', color: '#7c4dd8' },
  cerise: { bg: 'rgba(255,134,239,0.13)', color: '#c93ddb' },
  green: { bg: 'rgba(34,211,160,0.13)', color: '#04875f' },
  orange: { bg: 'rgba(255,157,77,0.16)', color: '#b45309' },
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
      className={`ice-card ice-card-interactive kpi-accent-${accent} p-5`}
      style={{ background: 'var(--kpi-card-bg)' }}
    >
      <div className="mb-3 flex items-start justify-between">
        <p
          className="pt-1 text-[10px] font-semibold uppercase tracking-[0.8px]"
          style={{ color: 'var(--kpi-label-color)' }}
        >
          {label}
        </p>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]"
          style={{ background: iconStyle.bg, color: iconStyle.color }}
        >
          <i className={`bi ${icon}`} aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <span
          className="font-display text-[28px] font-extrabold leading-none tracking-tight"
          style={{ color: 'var(--kpi-card-text)' }}
        >
          {value}
        </span>
        <span className="pb-0.5">{delta}</span>
      </div>
    </div>
  );
}
