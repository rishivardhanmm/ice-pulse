import {
  updateConnectionProfile,
  upsertCapability,
} from '@/server/db/repositories/canva.repo';
import { canvaApiFetch } from './apiClient';
import { getValidAccessToken } from './tokenService';
import type {
  CanvaCapabilitiesResponse,
  CanvaUserMeResponse,
  CanvaUserProfileResponse,
} from './types';

/**
 * Fetches the connected Canva user's identity, profile and capabilities, and
 * derives the feature flags Pulse cares about. Brand-template and autofill
 * capabilities require Canva Enterprise, so they are commonly unavailable here.
 *
 * Endpoints: GET /users/me, GET /users/me/profile, GET /users/me/capabilities.
 */

function scopeSet(grantedScopes: string): Set<string> {
  return new Set(grantedScopes.split(/\s+/).filter(Boolean));
}

/**
 * Fetch profile + capabilities for a connection and persist them. Returns the
 * derived feature availability map.
 */
export async function syncProfileAndCapabilities(
  connectionId: number,
  accessToken: string,
  grantedScopes: string,
): Promise<Record<string, boolean>> {
  // Identity + profile are best-effort: a failure here must not block the connect.
  let userId: string | null = null;
  let teamId: string | null = null;
  let displayName: string | null = null;
  try {
    const me = await canvaApiFetch<CanvaUserMeResponse>(accessToken, '/users/me');
    userId = me.user_id ?? null;
    teamId = me.team_id ?? null;
  } catch {
    /* identity unavailable — leave null */
  }
  try {
    const profile = await canvaApiFetch<CanvaUserProfileResponse>(accessToken, '/users/me/profile');
    displayName = profile.display_name ?? null;
  } catch {
    /* profile unavailable — leave null */
  }

  let rawCaps: string[] = [];
  try {
    const caps = await canvaApiFetch<CanvaCapabilitiesResponse>(
      accessToken,
      '/users/me/capabilities',
    );
    rawCaps = caps.capabilities ?? [];
  } catch {
    /* capabilities unavailable — treat as none */
  }

  await updateConnectionProfile(connectionId, {
    canvaUserId: userId,
    canvaTeamId: teamId,
    canvaEmail: null, // not provided by these scopes
    canvaDisplayName: displayName,
    scopes: grantedScopes,
  });

  const scopes = scopeSet(grantedScopes);
  const derived: Record<string, boolean> = {
    brand_template: rawCaps.includes('brand_template'),
    autofill: rawCaps.includes('autofill'),
    asset_upload: scopes.has('asset:write'),
    export: scopes.has('design:content:read'),
  };

  for (const [name, available] of Object.entries(derived)) {
    await upsertCapability(connectionId, name, available);
  }
  return derived;
}

/** Re-check capabilities on demand using the stored (refreshed) token. */
export async function refreshCapabilities(
  connectionId: number,
  grantedScopes: string,
): Promise<Record<string, boolean>> {
  const token = await getValidAccessToken(connectionId);
  return syncProfileAndCapabilities(connectionId, token, grantedScopes);
}
