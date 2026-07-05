import { randomBytes } from 'node:crypto';
import { getZohoSocialConfig } from '@/server/config/env';
import type { ZohoTokenResponse } from './types';

/** Zoho Social OAuth 2.0 — server-side flow (Authorization Code, no PKCE). */

export function createState(): string {
  return randomBytes(16).toString('hex');
}

/** Build the authorization URL for the consent screen redirect. */
export function buildAuthorizeUrl(state: string): string {
  const cfg = getZohoSocialConfig();
  const u = new URL(cfg.authorizeUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('scope', ZOHO_SCOPES);
  u.searchParams.set('state', state);
  u.searchParams.set('access_type', 'offline'); // request refresh token
  return u.toString();
}

export const ZOHO_SCOPES =
  'ZohoSocial.brands.READ,ZohoSocial.reports.READ,ZohoSocial.publish.READ,ZohoSocial.publish.CREATE';

async function postToken(body: URLSearchParams): Promise<ZohoTokenResponse> {
  const cfg = getZohoSocialConfig();
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho token request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as ZohoTokenResponse & { error?: string };
  if ('error' in json && json.error) {
    throw new Error(`Zoho OAuth error: ${json.error}`);
  }
  return json;
}

export function exchangeCodeForToken(code: string): Promise<ZohoTokenResponse> {
  const cfg = getZohoSocialConfig();
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      code,
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<ZohoTokenResponse> {
  const cfg = getZohoSocialConfig();
  return postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
    }),
  );
}
