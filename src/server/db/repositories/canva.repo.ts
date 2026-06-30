import { getPool, sql } from '../pool';
import { toIso } from '../utils';
import type { CanvaCapabilityDTO, CanvaTemplateDTO } from '../../../lib/types';
import type { CanvaConnectionRecord } from '../../../integrations/canva/types';

/**
 * Data access for the Canva integration tables. Tokens are stored ENCRYPTED by
 * the token service — this repo only persists the already-encrypted strings and
 * never decrypts or logs them.
 */

function mapConnection(r: Record<string, unknown>): CanvaConnectionRecord {
  return {
    id: Number(r.id),
    internalAccountId: (r.internal_account_id as string | null) ?? null,
    canvaUserId: (r.canva_user_id as string | null) ?? null,
    canvaTeamId: (r.canva_team_id as string | null) ?? null,
    canvaEmail: (r.canva_email as string | null) ?? null,
    canvaDisplayName: (r.canva_display_name as string | null) ?? null,
    connectionStatus: String(r.connection_status ?? 'disconnected'),
    scopes: (r.scopes as string | null) ?? null,
    connectedAt: toIso(r.connected_at),
    lastRefreshedAt: toIso(r.last_refreshed_at),
  };
}

const CONNECTION_COLS =
  'id, internal_account_id, canva_user_id, canva_team_id, canva_email, canva_display_name, connection_status, scopes, connected_at, last_refreshed_at';

/** The most recent connection regardless of status (for the status page). */
export async function getLatestConnection(): Promise<CanvaConnectionRecord | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .query(`SELECT TOP 1 ${CONNECTION_COLS} FROM dbo.canva_connections ORDER BY id DESC`);
  const row = res.recordset[0] as Record<string, unknown> | undefined;
  return row ? mapConnection(row) : null;
}

/** The active (connected) connection used for live API calls, if any. */
export async function getActiveConnection(): Promise<CanvaConnectionRecord | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .query(
      `SELECT TOP 1 ${CONNECTION_COLS} FROM dbo.canva_connections WHERE connection_status = 'connected' ORDER BY id DESC`,
    );
  const row = res.recordset[0] as Record<string, unknown> | undefined;
  return row ? mapConnection(row) : null;
}

/** Create a fresh connection row and return its id. */
export async function createConnection(internalAccountId: string | null): Promise<number> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('acct', sql.NVarChar(100), internalAccountId)
    .query(
      `INSERT INTO dbo.canva_connections (internal_account_id, connection_status, connected_at)
       OUTPUT INSERTED.id
       VALUES (@acct, 'connected', SYSUTCDATETIME())`,
    );
  return Number(res.recordset[0].id);
}

export interface ConnectionProfileUpdate {
  canvaUserId: string | null;
  canvaTeamId: string | null;
  canvaEmail: string | null;
  canvaDisplayName: string | null;
  scopes: string | null;
}

export async function updateConnectionProfile(
  id: number,
  p: ConnectionProfileUpdate,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.NVarChar(255), p.canvaUserId)
    .input('tid', sql.NVarChar(255), p.canvaTeamId)
    .input('email', sql.NVarChar(320), p.canvaEmail)
    .input('name', sql.NVarChar(255), p.canvaDisplayName)
    .input('scopes', sql.NVarChar(sql.MAX), p.scopes)
    .query(
      `UPDATE dbo.canva_connections
         SET canva_user_id = @uid, canva_team_id = @tid, canva_email = @email,
             canva_display_name = @name, scopes = @scopes, updated_at = SYSUTCDATETIME()
       WHERE id = @id`,
    );
}

export async function setConnectionStatus(
  id: number,
  status: string,
  opts: { touchRefreshed?: boolean } = {},
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(30), status)
    .query(
      `UPDATE dbo.canva_connections
         SET connection_status = @status,
             last_refreshed_at = ${opts.touchRefreshed ? 'SYSUTCDATETIME()' : 'last_refreshed_at'},
             updated_at = SYSUTCDATETIME()
       WHERE id = @id`,
    );
}

// ── Tokens (encrypted) ───────────────────────────────────────────────
export interface CanvaTokenRow {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenEncVersion: string;
  expiresAt: string | null;
  scopes: string | null;
}

export interface UpsertTokenParams {
  connectionId: number;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenEncVersion: string;
  expiresAt: Date | null;
  scopes: string | null;
}

export async function upsertToken(p: UpsertTokenParams): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('cid', sql.Int, p.connectionId)
    .input('at', sql.NVarChar(sql.MAX), p.accessTokenEncrypted)
    .input('rt', sql.NVarChar(sql.MAX), p.refreshTokenEncrypted)
    .input('ver', sql.NVarChar(20), p.tokenEncVersion)
    .input('exp', sql.DateTime2, p.expiresAt)
    .input('scopes', sql.NVarChar(sql.MAX), p.scopes)
    .query(
      `UPDATE dbo.canva_oauth_tokens
         SET access_token_encrypted = @at, refresh_token_encrypted = @rt,
             token_enc_version = @ver, expires_at = @exp, scopes = @scopes,
             updated_at = SYSUTCDATETIME()
       WHERE connection_id = @cid;
       IF @@ROWCOUNT = 0
         INSERT INTO dbo.canva_oauth_tokens
           (connection_id, access_token_encrypted, refresh_token_encrypted, token_enc_version, expires_at, scopes)
         VALUES (@cid, @at, @rt, @ver, @exp, @scopes);`,
    );
}

export async function getTokenRow(connectionId: number): Promise<CanvaTokenRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('cid', sql.Int, connectionId)
    .query(
      `SELECT access_token_encrypted, refresh_token_encrypted, token_enc_version, expires_at, scopes
       FROM dbo.canva_oauth_tokens WHERE connection_id = @cid`,
    );
  const r = res.recordset[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    accessTokenEncrypted: String(r.access_token_encrypted),
    refreshTokenEncrypted: (r.refresh_token_encrypted as string | null) ?? null,
    tokenEncVersion: String(r.token_enc_version ?? 'v1'),
    expiresAt: toIso(r.expires_at),
    scopes: (r.scopes as string | null) ?? null,
  };
}

export async function deleteTokens(connectionId: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('cid', sql.Int, connectionId)
    .query('DELETE FROM dbo.canva_oauth_tokens WHERE connection_id = @cid');
}

// ── Capabilities ─────────────────────────────────────────────────────
export async function upsertCapability(
  connectionId: number,
  name: string,
  available: boolean,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('cid', sql.Int, connectionId)
    .input('name', sql.NVarChar(80), name)
    .input('avail', sql.Bit, available)
    .query(
      `UPDATE dbo.canva_capabilities SET is_available = @avail, checked_at = SYSUTCDATETIME()
         WHERE connection_id = @cid AND capability_name = @name;
       IF @@ROWCOUNT = 0
         INSERT INTO dbo.canva_capabilities (connection_id, capability_name, is_available)
         VALUES (@cid, @name, @avail);`,
    );
}

export async function getCapabilities(connectionId: number): Promise<CanvaCapabilityDTO[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('cid', sql.Int, connectionId)
    .query(
      `SELECT capability_name, is_available, checked_at FROM dbo.canva_capabilities
       WHERE connection_id = @cid ORDER BY capability_name`,
    );
  return res.recordset.map((r) => ({
    name: String(r.capability_name),
    available: Boolean(r.is_available),
    checkedAt: toIso(r.checked_at),
  }));
}

// ── Templates ────────────────────────────────────────────────────────
export interface UpsertTemplateParams {
  connectionId: number;
  canvaTemplateId: string;
  title: string | null;
  thumbnailUrl: string | null;
  templateType: string | null;
  source: string;
}

export async function upsertTemplate(p: UpsertTemplateParams): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('cid', sql.Int, p.connectionId)
    .input('tpl', sql.NVarChar(255), p.canvaTemplateId)
    .input('title', sql.NVarChar(500), p.title)
    .input('thumb', sql.NVarChar(2000), p.thumbnailUrl)
    .input('type', sql.NVarChar(80), p.templateType)
    .input('source', sql.NVarChar(40), p.source)
    .query(
      `UPDATE dbo.canva_templates
         SET title = @title, thumbnail_url = @thumb, template_type = @type,
             source = @source, last_synced_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
       WHERE connection_id = @cid AND canva_template_id = @tpl;
       IF @@ROWCOUNT = 0
         INSERT INTO dbo.canva_templates
           (connection_id, canva_template_id, title, thumbnail_url, template_type, source)
         VALUES (@cid, @tpl, @title, @thumb, @type, @source);`,
    );
}

export async function listTemplates(
  connectionId: number,
  search?: string,
): Promise<CanvaTemplateDTO[]> {
  const pool = await getPool();
  const req = pool.request().input('cid', sql.Int, connectionId);
  let where = 'connection_id = @cid';
  if (search && search.trim()) {
    req.input('q', sql.NVarChar(500), `%${search.trim()}%`);
    where += ' AND title LIKE @q';
  }
  const res = await req.query(
    `SELECT TOP 200 id, canva_template_id, title, thumbnail_url, template_type, source, last_synced_at
     FROM dbo.canva_templates WHERE ${where} ORDER BY title, id`,
  );
  return res.recordset.map((r) => ({
    id: Number(r.id),
    canvaTemplateId: String(r.canva_template_id),
    title: (r.title as string | null) ?? null,
    thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
    templateType: (r.template_type as string | null) ?? null,
    source: String(r.source),
    lastSyncedAt: toIso(r.last_synced_at),
  }));
}

export async function getTemplateStats(
  connectionId: number,
): Promise<{ count: number; lastSyncedAt: string | null }> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('cid', sql.Int, connectionId)
    .query(
      `SELECT COUNT(*) AS cnt, MAX(last_synced_at) AS last_synced FROM dbo.canva_templates WHERE connection_id = @cid`,
    );
  const r = (res.recordset[0] ?? {}) as Record<string, unknown>;
  return { count: Number(r.cnt ?? 0), lastSyncedAt: toIso(r.last_synced) };
}

// ── Designs + export jobs ────────────────────────────────────────────
/** Find or create a design row for a Canva design id; returns the internal id. */
export async function upsertDesign(params: {
  connectionId: number;
  canvaDesignId: string;
  title: string | null;
  designUrl?: string | null;
}): Promise<number> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('cid', sql.Int, params.connectionId)
    .input('did', sql.NVarChar(255), params.canvaDesignId)
    .input('title', sql.NVarChar(500), params.title)
    .input('url', sql.NVarChar(2000), params.designUrl ?? null)
    .query(
      `UPDATE dbo.canva_designs SET title = COALESCE(@title, title), design_url = COALESCE(@url, design_url), updated_at = SYSUTCDATETIME()
         WHERE connection_id = @cid AND canva_design_id = @did;
       IF @@ROWCOUNT = 0
         INSERT INTO dbo.canva_designs (connection_id, canva_design_id, title, design_url) VALUES (@cid, @did, @title, @url);
       SELECT TOP 1 id FROM dbo.canva_designs WHERE connection_id = @cid AND canva_design_id = @did ORDER BY id DESC;`,
    );
  return Number(res.recordset[0].id);
}

export async function createExportJob(params: {
  designId: number;
  canvaExportId: string | null;
  exportFormat: string;
  status: string;
}): Promise<number> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('did', sql.Int, params.designId)
    .input('eid', sql.NVarChar(255), params.canvaExportId)
    .input('fmt', sql.NVarChar(20), params.exportFormat)
    .input('status', sql.NVarChar(30), params.status)
    .query(
      `INSERT INTO dbo.canva_export_jobs (design_id, canva_export_id, export_format, status)
       OUTPUT INSERTED.id VALUES (@did, @eid, @fmt, @status)`,
    );
  return Number(res.recordset[0].id);
}

export async function updateExportJob(
  id: number,
  p: { canvaExportId?: string | null; status: string; downloadUrl?: string | null; errorMessage?: string | null },
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('eid', sql.NVarChar(255), p.canvaExportId ?? null)
    .input('status', sql.NVarChar(30), p.status)
    .input('url', sql.NVarChar(2000), p.downloadUrl ?? null)
    .input('err', sql.NVarChar(1000), p.errorMessage ?? null)
    .query(
      `UPDATE dbo.canva_export_jobs
         SET canva_export_id = COALESCE(@eid, canva_export_id), status = @status,
             download_url = @url, error_message = @err, updated_at = SYSUTCDATETIME()
       WHERE id = @id`,
    );
}
