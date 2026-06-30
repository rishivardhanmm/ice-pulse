import { getPool, sql } from '../pool';
import { toIso } from '../utils';
import type { SyncRunDTO, SyncStatus } from '../../../lib/types';

function mapRun(r: Record<string, unknown>): SyncRunDTO {
  const startedAt = toIso(r.started_at);
  const finishedAt = toIso(r.finished_at);
  let metadata: Record<string, unknown> | null = null;
  if (r.metadata_json) {
    try {
      metadata = JSON.parse(String(r.metadata_json));
    } catch {
      metadata = null;
    }
  }
  const durationMs =
    startedAt && finishedAt
      ? new Date(finishedAt).getTime() - new Date(startedAt).getTime()
      : null;
  return {
    id: Number(r.id),
    source: String(r.source),
    status: String(r.status) as SyncStatus,
    startedAt: startedAt ?? new Date().toISOString(),
    finishedAt,
    durationMs,
    recordsProcessed: Number(r.records_processed ?? 0),
    recordsInserted: Number(r.records_inserted ?? 0),
    recordsUpdated: Number(r.records_updated ?? 0),
    errorMessage: (r.error_message as string) ?? null,
    metadata,
  };
}

export async function startSyncRun(
  source: string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('source', sql.NVarChar(40), source)
    .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
    .query(
      `INSERT INTO dbo.sync_runs (source, status, metadata_json)
       OUTPUT inserted.id AS id VALUES (@source, 'running', @metadata)`,
    );
  return Number(result.recordset[0].id);
}

export interface FinishSyncRunParams {
  status: Exclude<SyncStatus, 'running'>;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function finishSyncRun(id: number, params: FinishSyncRunParams): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(20), params.status)
    .input('processed', sql.Int, params.recordsProcessed)
    .input('inserted', sql.Int, params.recordsInserted)
    .input('updated', sql.Int, params.recordsUpdated)
    .input('error', sql.NVarChar(sql.MAX), params.errorMessage ?? null)
    .input('metadata', sql.NVarChar(sql.MAX), params.metadata ? JSON.stringify(params.metadata) : null)
    .query(
      `UPDATE dbo.sync_runs SET
         status = @status,
         finished_at = SYSUTCDATETIME(),
         records_processed = @processed,
         records_inserted = @inserted,
         records_updated = @updated,
         error_message = @error,
         metadata_json = COALESCE(@metadata, metadata_json)
       WHERE id = @id`,
    );
}

export async function listSyncRuns(limit = 25): Promise<SyncRunDTO[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('limit', sql.Int, limit)
    .query(`SELECT TOP (@limit) * FROM dbo.sync_runs ORDER BY started_at DESC, id DESC`);
  return result.recordset.map(mapRun);
}

export async function getLastSyncRun(
  source: string,
  status?: SyncStatus,
): Promise<SyncRunDTO | null> {
  const pool = await getPool();
  const req = pool.request().input('source', sql.NVarChar(40), source);
  let where = 'source = @source';
  if (status) {
    req.input('status', sql.NVarChar(20), status);
    where += ' AND status = @status';
  }
  const result = await req.query(
    `SELECT TOP 1 * FROM dbo.sync_runs WHERE ${where} ORDER BY started_at DESC, id DESC`,
  );
  return result.recordset.length ? mapRun(result.recordset[0]) : null;
}
