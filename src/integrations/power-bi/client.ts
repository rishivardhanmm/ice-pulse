/**
 * Power BI REST API client using service-principal (app-only) authentication.
 * Token is cached in memory and refreshed automatically before expiry.
 */

const AAD_TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
const PBI_SCOPE = 'https://analysis.windows.net/powerbi/api/.default';
const PBI_BASE = 'https://api.powerbi.com/v1.0/myorg';

interface TokenCache {
  value: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: PBI_SCOPE,
  });

  const res = await fetch(AAD_TOKEN_URL(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  interface TokenResponse {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  }
  const body = (await res.json()) as TokenResponse;

  if (!res.ok || !body.access_token) {
    throw new Error(
      `Power BI auth failed: ${body.error_description ?? body.error ?? `HTTP ${res.status}`}`,
    );
  }

  tokenCache = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return tokenCache.value;
}

async function pbiGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${PBI_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'ICEPulse/1.0' },
  });
  interface PBIError { error?: { code?: string; message?: string } }
  const body = (await res.json()) as PBIError & T;
  if (!res.ok) {
    throw new Error(
      `Power BI API ${res.status} at ${path}: ${body.error?.message ?? body.error?.code ?? 'unknown'}`,
    );
  }
  return body;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PBIWorkspace {
  id: string;
  name: string;
  type: string;
  isReadOnly: boolean;
}

export interface PBIReport {
  id: string;
  name: string;
  webUrl: string;
  embedUrl: string;
  datasetId: string;
  workspaceId: string;
  workspaceName: string;
  reportType?: string;
}

export interface PBIEmbedToken {
  token: string;
  tokenId: string;
  expiration: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function listWorkspaces(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<PBIWorkspace[]> {
  const token = await getAccessToken(tenantId, clientId, clientSecret);
  const data = await pbiGet<{ value: PBIWorkspace[] }>('/groups?$top=100&$filter=type eq \'Workspace\'', token);
  return data.value;
}

export async function listReportsInWorkspace(
  workspaceId: string,
  workspaceName: string,
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<PBIReport[]> {
  const token = await getAccessToken(tenantId, clientId, clientSecret);
  const data = await pbiGet<{ value: Omit<PBIReport, 'workspaceId' | 'workspaceName'>[] }>(
    `/groups/${workspaceId}/reports`,
    token,
  );
  return data.value.map((r) => ({ ...r, workspaceId, workspaceName }));
}

export async function generateEmbedToken(
  workspaceId: string,
  reportId: string,
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<PBIEmbedToken> {
  const token = await getAccessToken(tenantId, clientId, clientSecret);
  const res = await fetch(
    `${PBI_BASE}/groups/${workspaceId}/reports/${reportId}/GenerateToken`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ICEPulse/1.0',
      },
      body: JSON.stringify({ accessLevel: 'View' }),
    },
  );
  interface EmbedTokenResponse { token?: string; tokenId?: string; expiration?: string; error?: { message?: string } }
  const body = (await res.json()) as EmbedTokenResponse;
  if (!res.ok || !body.token) {
    throw new Error(`GenerateToken failed: ${body.error?.message ?? `HTTP ${res.status}`}`);
  }
  return { token: body.token, tokenId: body.tokenId ?? '', expiration: body.expiration ?? '' };
}
