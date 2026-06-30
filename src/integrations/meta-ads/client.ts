/**
 * Thin HTTP client for the Meta Graph API (Marketing API).
 * Uses Node fetch — no extra npm packages needed.
 *
 * All calls are GET requests with the access token in the query string (standard
 * for the Graph API server-side pattern). The token never appears in response bodies.
 */

const GRAPH_BASE = 'https://graph.facebook.com';

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  fbtrace_id?: string;
}

export class MetaApiException extends Error {
  readonly code: number;
  readonly fbtraceId: string | undefined;
  constructor(err: MetaApiError) {
    super(`Meta API error ${err.code}: ${err.message}`);
    this.name = 'MetaApiException';
    this.code = err.code;
    this.fbtraceId = err.fbtrace_id;
  }
}

async function graphGet<T>(
  apiVersion: string,
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${apiVersion}/${path.replace(/^\//, '')}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'ICEPulse/1.0' },
  });

  const body = (await res.json()) as { error?: MetaApiError } & T;

  if (body.error) throw new MetaApiException(body.error);
  if (!res.ok) throw new Error(`Meta API HTTP ${res.status} for ${path}`);

  return body;
}

// ── Ad Account info ───────────────────────────────────────────────────────────

export interface MetaAdAccountInfo {
  id: string;
  name: string;
  currency: string;
  account_status: number; // 1=ACTIVE 2=DISABLED 3=UNSETTLED 7=PENDING_REVIEW 9=IN_GRACE_PERIOD
  timezone_name: string;
}

export async function getAdAccountInfo(
  apiVersion: string,
  adAccountId: string,
  accessToken: string,
): Promise<MetaAdAccountInfo> {
  return graphGet<MetaAdAccountInfo>(
    apiVersion,
    adAccountId,
    { fields: 'id,name,currency,account_status,timezone_name' },
    accessToken,
  );
}

// ── Insights ──────────────────────────────────────────────────────────────────

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  reach?: string;
  spend: string;
  ctr?: string;
  cpc?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}

interface PagingCursors {
  before: string;
  after: string;
}

interface InsightsPage {
  data: MetaInsightRow[];
  paging?: { cursors?: PagingCursors; next?: string };
}

const INSIGHT_FIELDS = [
  'campaign_id',
  'campaign_name',
  'date_start',
  'date_stop',
  'impressions',
  'clicks',
  'reach',
  'spend',
  'ctr',
  'cpc',
  'actions',
  'action_values',
].join(',');

/**
 * Fetch campaign-level daily insights for an ad account over a date range.
 * Automatically follows pagination.
 */
export async function fetchInsights(
  apiVersion: string,
  adAccountId: string,
  from: string,
  to: string,
  accessToken: string,
): Promise<MetaInsightRow[]> {
  const rows: MetaInsightRow[] = [];
  let afterCursor: string | undefined;

  do {
    const params: Record<string, string> = {
      level: 'campaign',
      fields: INSIGHT_FIELDS,
      time_increment: '1',
      time_range: JSON.stringify({ since: from, until: to }),
      limit: '500',
    };
    if (afterCursor) params.after = afterCursor;

    const page = await graphGet<InsightsPage>(
      apiVersion,
      `${adAccountId}/insights`,
      params,
      accessToken,
    );

    rows.push(...page.data);

    afterCursor =
      page.paging?.next && page.paging.cursors?.after
        ? page.paging.cursors.after
        : undefined;
  } while (afterCursor);

  return rows;
}
