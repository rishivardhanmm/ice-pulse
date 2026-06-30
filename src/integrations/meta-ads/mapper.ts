import type { MetaInsightRow, MetaAction } from './client';

export interface MappedMetaRow {
  campaignId: string;
  campaignName: string;
  metricDate: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  reach: number | null;
  spend: number;
  conversions: number;
  conversionsValue: number;
  ctr: number | null;
  cpc: number | null;
  costPerConversion: number | null;
  rawPayloadJson: string;
}

/** Sum all action values of any type (gives a single "conversions" figure). */
function sumActions(actions: MetaAction[] | undefined): number {
  if (!actions) return 0;
  return actions.reduce((acc, a) => acc + parseFloat(a.value || '0'), 0);
}

function parseNum(v: string | undefined | null): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export function mapInsightRow(row: MetaInsightRow): MappedMetaRow | null {
  if (!row.campaign_id || !row.date_start) return null;

  const impressions = parseInt(row.impressions ?? '0', 10) || 0;
  const clicks = parseInt(row.clicks ?? '0', 10) || 0;
  const spend = parseFloat(row.spend ?? '0') || 0;
  const conversions = sumActions(row.actions);
  const conversionsValue = sumActions(row.action_values);
  const ctr = parseNum(row.ctr);
  const cpc = parseNum(row.cpc);
  const costPerConversion = conversions > 0 ? Math.round((spend / conversions) * 10000) / 10000 : null;
  const reach = row.reach ? parseInt(row.reach, 10) || null : null;

  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name ?? '',
    metricDate: row.date_start,
    impressions,
    clicks,
    reach,
    spend,
    conversions,
    conversionsValue,
    ctr,
    cpc,
    costPerConversion,
    rawPayloadJson: JSON.stringify(row),
  };
}
