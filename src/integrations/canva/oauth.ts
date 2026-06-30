import { getCanvaConfig } from '@/server/config/env';
import { codeChallengeFor } from './pkce';
import type { CanvaTokenResponse } from './types';

/**
 * Low-level Canva OAuth 2.0 calls (Authorization Code + PKCE).
 *
 * Docs: https://www.canva.dev/docs/connect/authentication/ and
 *       https://www.canva.dev/docs/connect/api-reference/authentication/generate-access-token/
 * The token endpoint authenticates the client with HTTP Basic
 * (base64(client_id:client_secret)). Refresh tokens are single-use.
 */

function basicAuthHeader(): string {
  const { clientId, clientSecret } = getCanvaConfig();
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/** Build the authorize URL (response_type=code, PKCE S256). */
export function buildAuthorizeUrl(params: { state: string; codeVerifier: string }): string {
  const cfg = getCanvaConfig();
  const u = new URL(cfg.authorizeUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('scope', cfg.scopes);
  u.searchParams.set('state', params.state);
  u.searchParams.set('code_challenge', codeChallengeFor(params.codeVerifier));
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

async function postToken(body: URLSearchParams): Promise<CanvaTokenResponse> {
  const cfg = getCanvaConfig();
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuthHeader(),
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Canva token request failed (${res.status}): ${describeOAuthError(text)}`);
  }
  return JSON.parse(text) as CanvaTokenResponse;
}

/** Exchange an authorization code for tokens. */
export function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
}): Promise<CanvaTokenResponse> {
  const cfg = getCanvaConfig();
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: cfg.redirectUri,
    }),
  );
}

/** Refresh an access token (rotates the refresh token). */
export function refreshAccessToken(refreshToken: string): Promise<CanvaTokenResponse> {
  return postToken(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }));
}

/** Extract Canva's error/error_description (token error bodies never contain tokens). */
function describeOAuthError(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: string; error_description?: string };
    return [j.error, j.error_description].filter(Boolean).join(': ') || 'unknown error';
  } catch {
    return 'unknown error';
  }
}
