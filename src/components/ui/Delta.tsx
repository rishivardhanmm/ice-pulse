import { percentChange } from '@/lib/format';

/**
 * Small change chip comparing current vs previous. Renders nothing when the
 * change is not computable (e.g. no previous data). `invert` flips the colour
 * logic for metrics where lower is better (e.g. cost per conversion).
 */
export function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  const change = percentChange(current, previous);
  if (change === null) return null;

  const rounded = Math.round(change * 10) / 10;
  const isFlat = rounded === 0;
  const isGood = invert ? rounded < 0 : rounded > 0;
  const color = isFlat ? 'var(--text-muted)' : isGood ? 'var(--green)' : 'var(--red)';
  const icon = isFlat ? 'bi-dash' : rounded > 0 ? 'bi-arrow-up-short' : 'bi-arrow-down-short';

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ color, background: 'color-mix(in srgb, currentColor 14%, transparent)' }}
      title="vs previous period"
    >
      <i className={`bi ${icon}`} aria-hidden="true" />
      {Math.abs(rounded)}%
    </span>
  );
}
