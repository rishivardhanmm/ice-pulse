/** Date helpers shared by server and client. All dates are UTC YYYY-MM-DD strings. */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(s: string | null | undefined): boolean {
  if (!s || !DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(`${s}T00:00:00.000Z`).getTime());
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysInclusive(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00.000Z`).getTime();
  const t = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.round((t - f) / 86_400_000) + 1;
}

export function defaultRange(days = 30): { from: string; to: string } {
  const to = todayUtc();
  return { from: shiftDays(to, -(days - 1)), to };
}

/** The equal-length period immediately preceding [from, to]. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const len = daysInclusive(from, to);
  const prevTo = shiftDays(from, -1);
  return { from: shiftDays(prevTo, -(len - 1)), to: prevTo };
}

export interface RangePreset {
  key: string;
  label: string;
  days: number;
}

export const RANGE_PRESETS: RangePreset[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '14d', label: 'Last 14 days', days: 14 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
];
