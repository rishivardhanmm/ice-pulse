import {
  getTokenRow,
  setConnectionStatus,
  upsertToken,
} from '@/server/db/repositories/canva.repo';
import { logger } from '@/server/logger';
import { decryptToken, encryptToken } from './crypto';
import { refreshAccessToken } from './oauth';
import type { CanvaTokenResponse } from './types';

/**
 * Canva token lifecycle. Tokens are encrypted at rest and NEVER returned to the
 * frontend or logged. Access tokens are auto-refreshed (single-use refresh
 * token) when expired; on failure the connection is marked expired.
 */

const EXPIRY_SKEW_MS = 60_000; // refresh a minute before actual expiry

/** Persist a token response (rotating refresh token) for a connection. */
export async function storeTokenResponse(
  connectionId: number,
  tok: CanvaTokenResponse,
): Promise<void> {
  const access = encryptToken(tok.access_token);
  const refresh = tok.refresh_token ? encryptToken(tok.refresh_token) : null;
  await upsertToken({
    connectionId,
    accessTokenEncrypted: access.value,
    refreshTokenEncrypted: refresh?.value ?? null,
    tokenEncVersion: access.version,
    expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
    scopes: tok.scope ?? null,
  });
}

/**
 * Returns a valid access token for the connection, refreshing it if expired.
 * Throws (and marks the connection expired) when no usable token is available.
 */
export async function getValidAccessToken(connectionId: number): Promise<string> {
  const row = await getTokenRow(connectionId);
  if (!row) throw new Error('No Canva token stored. Please connect Canva again.');

  const stillValid =
    row.expiresAt && new Date(row.expiresAt).getTime() - EXPIRY_SKEW_MS > Date.now();
  if (stillValid) return decryptToken(row.accessTokenEncrypted, row.tokenEncVersion);

  if (!row.refreshTokenEncrypted) {
    await setConnectionStatus(connectionId, 'expired');
    throw new Error('Canva session expired and cannot be refreshed. Please reconnect Canva.');
  }

  try {
    const refreshToken = decryptToken(row.refreshTokenEncrypted, row.tokenEncVersion);
    const tok = await refreshAccessToken(refreshToken);
    await storeTokenResponse(connectionId, tok);
    await setConnectionStatus(connectionId, 'connected', { touchRefreshed: true });
    return tok.access_token;
  } catch {
    await setConnectionStatus(connectionId, 'expired');
    logger.warn('Canva token refresh failed', { connectionId });
    throw new Error('Could not refresh the Canva connection. Please reconnect Canva.');
  }
}
