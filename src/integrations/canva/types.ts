/**
 * Canva Connect API response shapes (per the official docs) and the internal
 * record shapes used across the Canva integration.
 *
 * Docs: https://www.canva.dev/docs/connect/
 */

// ── OAuth / token endpoint ───────────────────────────────────────────
export interface CanvaTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string; // "Bearer"
  expires_in: number; // seconds (currently ~4h)
  scope?: string; // space-separated granted scopes
}

// ── Users ────────────────────────────────────────────────────────────
/** GET /v1/users/me — identity. */
export interface CanvaUserMeResponse {
  team_id?: string;
  user_id?: string;
}
/** GET /v1/users/me/profile — display name. */
export interface CanvaUserProfileResponse {
  display_name?: string;
}
/** GET /v1/users/me/capabilities — { capabilities: [...] }. */
export interface CanvaCapabilitiesResponse {
  capabilities?: string[];
}

// ── Brand templates (requires the brand_template capability / Enterprise) ──
export interface CanvaBrandTemplate {
  id: string;
  title?: string;
  thumbnail?: { url?: string };
  view_url?: string;
  create_url?: string;
}
export interface CanvaBrandTemplateListResponse {
  items?: CanvaBrandTemplate[];
  continuation?: string;
}

// ── Exports ──────────────────────────────────────────────────────────
export type CanvaExportStatus = 'in_progress' | 'success' | 'failed';
export interface CanvaExportJob {
  id: string;
  status: CanvaExportStatus;
  urls?: string[];
  error?: { code?: string; message?: string };
}
export interface CanvaExportJobResponse {
  job: CanvaExportJob;
}

// ── Internal records (snake_case DB → camelCase here) ─────────────────
export interface CanvaConnectionRecord {
  id: number;
  internalAccountId: string | null;
  canvaUserId: string | null;
  canvaTeamId: string | null;
  canvaEmail: string | null;
  canvaDisplayName: string | null;
  connectionStatus: string;
  scopes: string | null;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
}

export interface CanvaStoredToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string | null;
}

/** The feature capabilities Pulse tracks (derived from the API + granted scopes). */
export const CANVA_FEATURE_CAPABILITIES = [
  'brand_template',
  'autofill',
  'asset_upload',
  'export',
] as const;
export type CanvaFeatureCapability = (typeof CANVA_FEATURE_CAPABILITIES)[number];
