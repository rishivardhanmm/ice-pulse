import type { MetricsTotals } from '../../lib/types';

/** Coerce a DB value (number | numeric-string | null) to a finite number, default 0. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function round(n: number | null, dp = 2): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Format a DATE/DATETIME DB value as YYYY-MM-DD (UTC), or null. */
export function toDateString(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Format a DATETIME DB value as an ISO string, or null. */
export function toIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Parse a YYYY-MM-DD input into a UTC-midnight Date for DATE-typed parameters. */
export function parseDateInput(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

interface RawTotals {
  spend?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  conversions?: unknown;
  conversions_value?: unknown;
}

/**
 * Derive a complete, rounded MetricsTotals from raw summed columns. Rates are
 * computed here (not stored) so they are always internally consistent with the
 * summed spend/clicks/impressions, and divide-by-zero yields 0 or null.
 */
export function deriveTotals(raw: RawTotals): MetricsTotals {
  const spend = num(raw.spend);
  const impressions = num(raw.impressions);
  const clicks = num(raw.clicks);
  const conversions = num(raw.conversions);
  const conversionsValue = num(raw.conversions_value);

  return {
    spend: round(spend) ?? 0,
    impressions: Math.round(impressions),
    clicks: Math.round(clicks),
    conversions: round(conversions) ?? 0,
    conversionsValue: round(conversionsValue) ?? 0,
    ctr: round(impressions > 0 ? (clicks / impressions) * 100 : 0) ?? 0,
    averageCpc: clicks > 0 ? round(spend / clicks) : null,
    costPerConversion: conversions > 0 ? round(spend / conversions) : null,
    conversionRate: clicks > 0 ? round((conversions / clicks) * 100) : null,
  };
}

export const EMPTY_TOTALS: MetricsTotals = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  conversionsValue: 0,
  ctr: 0,
  averageCpc: null,
  costPerConversion: null,
  conversionRate: null,
};
