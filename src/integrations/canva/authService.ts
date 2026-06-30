import { describeConfigState, getCanvaConfig } from '@/server/config/env';
import {
  createConnection,
  deleteTokens,
  getCapabilities,
  getLatestConnection,
  getTemplateStats,
  setConnectionStatus,
} from '@/server/db/repositories/canva.repo';
import { logger } from '@/server/logger';
import type { CanvaConnectionDTO, CanvaStatusDTO } from '@/lib/types';
import { syncProfileAndCapabilities } from './capabilityService';
import { buildAuthorizeUrl, exchangeCodeForToken } from './oauth';
import { createCodeVerifier, createState } from './pkce';
import { storeTokenResponse } from './tokenService';
import type { CanvaConnectionRecord } from './types';

/** Begin the OAuth flow: returns the authorize URL plus the state + verifier to stash server-side. */
export function startConnect(): { url: string; state: string; codeVerifier: string } {
  const state = createState();
  const codeVerifier = createCodeVerifier();
  return { url: buildAuthorizeUrl({ state, codeVerifier }), state, codeVerifier };
}

/** Complete OAuth: exchange the code, store the connection + encrypted tokens, sync profile/capabilities. */
export async function completeOAuth(code: string, codeVerifier: string): Promise<number> {
  const tok = await exchangeCodeForToken({ code, codeVerifier });
  const connectionId = await createConnection('ice-default');
  await storeTokenResponse(connectionId, tok);
  const grantedScopes = tok.scope ?? getCanvaConfig().scopes;
  try {
    await syncProfileAndCapabilities(connectionId, tok.access_token, grantedScopes);
  } catch (err) {
    // Profile/capability fetch is best-effort — the connection is still valid.
    logger.warn('Canva profile/capability sync failed after connect', {
      connectionId,
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }
  logger.info('Canva connected', { connectionId });
  return connectionId;
}

/** Disconnect: remove stored tokens and mark the connection disconnected. */
export async function disconnect(): Promise<void> {
  const conn = await getLatestConnection();
  if (!conn) return;
  await deleteTokens(conn.id);
  await setConnectionStatus(conn.id, 'disconnected');
  logger.info('Canva disconnected', { connectionId: conn.id });
}

function toConnectionDTO(c: CanvaConnectionRecord): CanvaConnectionDTO {
  return {
    status: c.connectionStatus,
    canvaUserId: c.canvaUserId,
    canvaTeamId: c.canvaTeamId,
    email: c.canvaEmail,
    displayName: c.canvaDisplayName,
    scopes: (c.scopes ?? '').split(/\s+/).filter(Boolean),
    connectedAt: c.connectedAt,
    lastRefreshedAt: c.lastRefreshedAt,
  };
}

/** Build the value-free status DTO for the settings page (never exposes tokens). */
export async function getStatus(): Promise<CanvaStatusDTO> {
  const cfg = describeConfigState().canva;

  let capabilities: CanvaStatusDTO['capabilities'] = [];
  let templateCount = 0;
  let lastTemplateSyncAt: string | null = null;
  let conn: CanvaConnectionRecord | null = null;
  try {
    conn = await getLatestConnection();
    if (conn) {
      capabilities = await getCapabilities(conn.id);
      const stats = await getTemplateStats(conn.id);
      templateCount = stats.count;
      lastTemplateSyncAt = stats.lastSyncedAt;
    }
  } catch (err) {
    // Tolerate a missing schema (pre-migration) — report config state, no connection.
    logger.warn('Canva status DB read failed (run db:migrate?)', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  return {
    configured: cfg.configured,
    hasEncryptionKey: cfg.hasEncryptionKey,
    redirectUri: cfg.redirectUri,
    requestedScopes: cfg.scopes.split(/\s+/).filter(Boolean),
    connected: conn?.connectionStatus === 'connected',
    connection: conn ? toConnectionDTO(conn) : null,
    capabilities,
    templateCount,
    lastTemplateSyncAt,
  };
}
