import { describeConfigState } from '@/server/config/env';
import {
  createZohoConnection,
  deleteZohoTokens,
  getLatestZohoConnection,
  getZohoSocialSummary,
  listZohoBrands,
  listZohoProfiles,
  setZohoConnectionStatus,
} from '@/server/db/repositories/zoho-social.repo';
import { logger } from '@/server/logger';
import { buildAuthorizeUrl, createState, exchangeCodeForToken, ZOHO_SCOPES } from './oauth';
import { storeTokenResponse } from './tokenService';
import type { ZohoConnectionRecord } from './types';

export { zohoSocialConnector } from './connector';

/** Start OAuth — returns the authorize URL and the state to store in a cookie. */
export function startZohoConnect(): { url: string; state: string } {
  const state = createState();
  return { url: buildAuthorizeUrl(state), state };
}

/** Complete OAuth: exchange code, store connection + tokens. */
export async function completeZohoOAuth(
  code: string,
  connectedBy: number,
): Promise<number> {
  const tok = await exchangeCodeForToken(code);
  const { orgId } = describeConfigState().zohoSocial as { orgId?: string } & object;
  // orgId comes from env, confirmed configured before this call
  const { getZohoSocialConfig } = await import('@/server/config/env');
  const cfg = getZohoSocialConfig();
  const connectionId = await createZohoConnection({ orgId: cfg.orgId, connectedBy });
  await storeTokenResponse(connectionId, tok);
  logger.info('Zoho Social connected', { connectionId });
  return connectionId;
}

/** Disconnect: clear tokens and mark disconnected. */
export async function disconnectZohoSocial(): Promise<void> {
  const conn = await getLatestZohoConnection();
  if (!conn) return;
  await deleteZohoTokens(conn.id);
  await setZohoConnectionStatus(conn.id, 'disconnected');
  logger.info('Zoho Social disconnected', { connectionId: conn.id });
}

export interface ZohoSocialStatusDTO {
  configured: boolean;
  connected: boolean;
  connection: {
    status: string;
    orgId: string;
    connectedAt: string;
    lastRefreshedAt: string | null;
    scopes: string[];
    brandCount: number;
    profileCount: number;
  } | null;
}

export async function getZohoSocialStatus(): Promise<ZohoSocialStatusDTO> {
  const cfg = describeConfigState().zohoSocial;
  let conn: ZohoConnectionRecord | null = null;
  let brandCount = 0;
  let profileCount = 0;

  try {
    conn = await getLatestZohoConnection();
    if (conn) {
      const brands = await listZohoBrands(conn.id);
      brandCount = brands.length;
      for (const b of brands) {
        const profiles = await listZohoProfiles(b.id);
        profileCount += profiles.length;
      }
    }
  } catch {
    // tolerate pre-migration state
  }

  return {
    configured: cfg.configured,
    connected: conn?.status === 'connected',
    connection: conn
      ? {
          status: conn.status,
          orgId: conn.orgId,
          connectedAt: conn.connectedAt.toISOString(),
          lastRefreshedAt: conn.lastRefreshedAt?.toISOString() ?? null,
          scopes: (conn.scopes ?? ZOHO_SCOPES).split(',').filter(Boolean),
          brandCount,
          profileCount,
        }
      : null,
  };
}

export { getZohoSocialSummary };
