const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string, label: string): void {
  if (!DATE_RE.test(value)) {
    throw new Error(`Invalid ${label} date "${value}" — expected YYYY-MM-DD.`);
  }
}

/**
 * GAQL query for campaign performance segmented by day. `from`/`to` are
 * validated as YYYY-MM-DD before interpolation (GAQL has no parameter binding).
 */
export function buildCampaignMetricsQuery(from: string, to: string): string {
  assertDate(from, 'from');
  assertDate(to, 'to');
  return `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone,
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date BETWEEN '${from}' AND '${to}'
    ORDER BY segments.date DESC
  `.trim();
}

/** Minimal query used to validate credentials / connectivity. */
export const CONNECTION_TEST_QUERY = `
  SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone
  FROM customer
  LIMIT 1
`.trim();
