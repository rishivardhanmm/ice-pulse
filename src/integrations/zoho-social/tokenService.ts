import {
  getZohoConnection,
  setZohoConnectionStatus,
  upsertZohoToken,
} from '@/server/db/repositories/zoho-social.repo';
import { logger } from '@/server/logger';
import { decryptToken, encryptToken } from './crypto';
import { refreshAccessToken } from './oauth';
import type { ZohoTokenResponse } from './types';

const EXPIRY_SKEW_MS = 60_000;

export async function storeTokenResponse(
  connectionId: number,
  tok: ZohoTokenResponse,
): Promise<void> {
  const access = encryptToken(tok.access_token);
  const refresh = tok.refresh_token ? encryptToken(tok.refresh_token) : null;
  await upsertZohoToken({
    connectionId,
    accessTokenEncrypted: access.value,
    refreshTokenEncrypted: refresh?.value ?? null,
    tokenEncVersion: access.version,
    expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
    scopes: tok.scope ?? null,
  });
}

/** Returns a valid access token, refreshing when expired. */
export async function getValidAccessToken(connectionId: number): Promise<string> {
  const row = await getZohoConnection(connectionId);
  if (!row) throw new Error('No Zoho Social token found. Please connect Zoho Social again.');

  const stillValid =
    row.expiresAt && new Date(row.expiresAt).getTime() - EXPIRY_SKEW_MS > Date.now();
  if (stillValid) return decryptToken(row.accessTokenEncrypted, row.tokenEncVersion);

  if (!row.refreshTokenEncrypted) {
    await setZohoConnectionStatus(connectionId, 'expired');
    throw new Error('Zoho Social session expired. Please reconnect.');
  }

  try {
    const refreshToken = decryptToken(row.refreshTokenEncrypted, row.tokenEncVersion);
    const tok = await refreshAccessToken(refreshToken);
    await storeTokenResponse(connectionId, tok);
    await setZohoConnectionStatus(connectionId, 'connected', true);
    return tok.access_token;
  } catch {
    await setZohoConnectionStatus(connectionId, 'expired');
    logger.warn('Zoho Social token refresh failed', { connectionId });
    throw new Error('Could not refresh the Zoho Social connection. Please reconnect.');
  }
}
