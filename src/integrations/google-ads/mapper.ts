import { num } from '../../server/db/utils';

/**
 * Loose shape of a Google Ads API result row for the campaign metrics query.
 * Fields are optional because the library may omit zero/empty metrics, and
 * enums may arrive as numbers or strings depending on the client version.
 */
export interface GoogleAdsResultRow {
  customer?: {
    id?: number | string;
    descriptive_name?: string;
    currency_code?: string;
    time_zone?: string;
  };
  campaign?: {
    id?: number | string;
    name?: string;
    status?: number | string;
    advertising_channel_type?: number | string;
    start_date?: string;
    end_date?: string;
  };
  segments?: { date?: string };
  metrics?: {
    impressions?: number | string;
    clicks?: number | string;
    ctr?: number;
    average_cpc?: number | string;
    cost_micros?: number | string;
    conversions?: number;
    conversions_value?: number;
    cost_per_conversion?: number | string;
  };
}

// Google Ads enum values (numeric → name) for the fields we store. The client
// often returns string names already; these cover the case where it returns
// the raw enum integer.
const CAMPAIGN_STATUS: Record<number, string> = {
  0: 'UNSPECIFIED',
  1: 'UNKNOWN',
  2: 'ENABLED',
  3: 'PAUSED',
  4: 'REMOVED',
};

const CHANNEL_TYPE: Record<number, string> = {
  0: 'UNSPECIFIED',
  1: 'UNKNOWN',
  2: 'SEARCH',
  3: 'DISPLAY',
  4: 'SHOPPING',
  5: 'HOTEL',
  6: 'VIDEO',
  7: 'MULTI_CHANNEL',
  8: 'LOCAL',
  9: 'SMART',
  10: 'PERFORMANCE_MAX',
  11: 'LOCAL_SERVICES',
  12: 'DISCOVERY',
  13: 'TRAVEL',
  14: 'DEMAND_GEN',
};

function enumToString(
  value: number | string | undefined,
  map: Record<number, string>,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return map[value] ?? String(value);
}

const MICROS = 1_000_000;

export interface MappedGoogleAdsRow {
  customerId: string;
  customerName: string | null;
  currencyCode: string | null;
  timezone: string | null;
  campaign: {
    id: string;
    name: string | null;
    status: string | null;
    channelType: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  metricDate: string;
  metrics: {
    impressions: number;
    clicks: number;
    costMicros: number;
    cost: number;
    conversions: number;
    conversionsValue: number;
    ctr: number | null;
    averageCpc: number | null;
    costPerConversion: number | null;
    conversionRate: number | null;
  };
  rawPayloadJson: string;
}

/**
 * Maps one API row to normalised insert params. Monetary metrics (avg CPC,
 * cost per conversion) and rates are DERIVED from cost/clicks/impressions/
 * conversions so they stay internally consistent with the stored totals; the
 * original API row is preserved in raw_payload_json for debugging.
 */
export function mapResultRow(row: GoogleAdsResultRow): MappedGoogleAdsRow | null {
  const campaignId = row.campaign?.id;
  const metricDate = row.segments?.date;
  // Without a campaign id and date we cannot key the metric — skip the row.
  if (campaignId === undefined || campaignId === null || !metricDate) return null;

  const impressions = num(row.metrics?.impressions);
  const clicks = num(row.metrics?.clicks);
  const costMicros = num(row.metrics?.cost_micros);
  const cost = costMicros / MICROS;
  const conversions = num(row.metrics?.conversions);
  const conversionsValue = num(row.metrics?.conversions_value);

  return {
    customerId: String(row.customer?.id ?? ''),
    customerName: row.customer?.descriptive_name ?? null,
    currencyCode: row.customer?.currency_code ?? null,
    timezone: row.customer?.time_zone ?? null,
    campaign: {
      id: String(campaignId),
      name: row.campaign?.name ?? null,
      status: enumToString(row.campaign?.status, CAMPAIGN_STATUS),
      channelType: enumToString(row.campaign?.advertising_channel_type, CHANNEL_TYPE),
      startDate: row.campaign?.start_date ?? null,
      endDate: row.campaign?.end_date ?? null,
    },
    metricDate,
    metrics: {
      impressions,
      clicks,
      costMicros,
      cost: Math.round(cost * 100) / 100,
      conversions,
      conversionsValue,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      averageCpc: clicks > 0 ? cost / clicks : null,
      costPerConversion: conversions > 0 ? cost / conversions : null,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : null,
    },
    rawPayloadJson: JSON.stringify(row),
  };
}
