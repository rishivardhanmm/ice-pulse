import { JWT } from 'google-auth-library';
import { getGoogleAdsServiceAccountConfig } from '../../server/config/env';
import type { GoogleAdsResultRow } from './mapper';

/**
 * Google Ads access via a service account using Workspace **domain-wide
 * delegation**. The `google-ads-api` client only supports the OAuth refresh
 * token flow, so this path mints an impersonated access token with
 * google-auth-library and calls the Google Ads REST API (`searchStream`)
 * directly. REST returns camelCase fields, which are converted to the snake_case
 * shape the shared mapper expects.
 */

const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';

let cachedClient: JWT | null = null;
let cacheKey = '';

function getJwtClient(): JWT {
  const cfg = getGoogleAdsServiceAccountConfig();
  const key = `${cfg.clientEmail}|${cfg.impersonationEmail ?? ''}`;
  if (cachedClient && cacheKey === key) return cachedClient;
  cachedClient = new JWT({
    email: cfg.clientEmail,
    key: cfg.privateKey,
    scopes: [ADWORDS_SCOPE],
    // Impersonate only when an email is given (Workspace domain-wide delegation).
    // Otherwise the service account authenticates as itself — its client_email
    // must be added as a user on the Google Ads account.
    subject: cfg.impersonationEmail || undefined,
  });
  cacheKey = key;
  return cachedClient;
}

function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/** Recursively convert object keys from camelCase to snake_case. */
function deepSnake(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSnake);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[camelToSnake(k)] = deepSnake(v);
    }
    return out;
  }
  return value;
}

interface RestError {
  error?: {
    message?: string;
    status?: string;
    details?: Array<{ errors?: Array<{ message?: string; errorCode?: Record<string, unknown> }> }>;
  };
}

function parseRestError(status: number, data: unknown, fallback: string): string {
  const d = data as RestError | null;
  if (d?.error) {
    const parts: string[] = [];
    if (d.error.message) parts.push(d.error.message);
    for (const detail of d.error.details ?? []) {
      for (const e of detail.errors ?? []) {
        const code = e.errorCode ? Object.values(e.errorCode)[0] : undefined;
        if (e.message) parts.push(code ? `${e.message} (${String(code)})` : e.message);
      }
    }
    if (parts.length > 0) return `Google Ads API ${status}: ${parts.join('; ')}`;
  }
  return `Google Ads API ${status}: ${fallback.slice(0, 500)}`;
}

/** Runs a GAQL query via the REST searchStream endpoint; returns mapper-ready rows. */
export async function serviceAccountQuery(gaql: string): Promise<GoogleAdsResultRow[]> {
  const cfg = getGoogleAdsServiceAccountConfig();
  const { token } = await getJwtClient().getAccessToken();
  if (!token) {
    throw new Error(
      'Failed to obtain a service-account access token. Check the key file and that ' +
        'domain-wide delegation for the adwords scope is configured in Google Workspace.',
    );
  }

  const customerId = cfg.customerId.replace(/[^0-9]/g, '');
  const url = `https://googleads.googleapis.com/${cfg.apiVersion}/customers/${customerId}/googleAds:searchStream`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': cfg.developerToken,
    'content-type': 'application/json',
  };
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId.replace(/[^0-9]/g, '');

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query: gaql }) });
  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!resp.ok) {
    throw new Error(parseRestError(resp.status, data, text));
  }

  // searchStream returns a JSON array of response chunks, each with `results`.
  const chunks = Array.isArray(data) ? data : data ? [data] : [];
  const rows: GoogleAdsResultRow[] = [];
  for (const chunk of chunks) {
    const results = (chunk as { results?: unknown[] })?.results;
    if (Array.isArray(results)) {
      for (const r of results) rows.push(deepSnake(r) as GoogleAdsResultRow);
    }
  }
  return rows;
}
