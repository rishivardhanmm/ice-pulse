import { getPool, sql } from '../pool';
import { toIso } from '../utils';

export interface SyncScheduleRow {
  id: number;
  source: string;
  enabled: boolean;
  intervalMinutes: number;
  lookbackDays: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): SyncScheduleRow {
  return {
    id: Number(r.id),
    source: String(r.source),
    enabled: Boolean(r.enabled),
    intervalMinutes: Number(r.interval_minutes),
    lookbackDays: Number(r.lookback_days),
    lastRunAt: toIso(r.last_run_at),
    lastStatus: (r.last_status as string) ?? null,
    updatedAt: toIso(r.updated_at) ?? new Date().toISOString(),
  };
}

export async function listSchedules(): Promise<SyncScheduleRow[]> {
  const pool = await getPool();
  const res = await pool.request().query(
    `SELECT id, source, enabled, interval_minutes, lookback_days, last_run_at, last_status, updated_at
     FROM dbo.sync_schedules ORDER BY source`,
  );
  return res.recordset.map(mapRow);
}

export async function getSchedule(source: string): Promise<SyncScheduleRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('source', sql.NVarChar(40), source)
    .query(
      `SELECT id, source, enabled, interval_minutes, lookback_days, last_run_at, last_status, updated_at
       FROM dbo.sync_schedules WHERE source = @source`,
    );
  return res.recordset[0] ? mapRow(res.recordset[0]) : null;
}

export async function updateSchedule(
  source: string,
  input: { enabled?: boolean; intervalMinutes?: number; lookbackDays?: number },
): Promise<SyncScheduleRow | null> {
  const pool = await getPool();
  await pool
    .request()
    .input('source', sql.NVarChar(40), source)
    .input('enabled', sql.Bit, input.enabled === undefined ? null : input.enabled)
    .input('intervalMinutes', sql.Int, input.intervalMinutes ?? null)
    .input('lookbackDays', sql.Int, input.lookbackDays ?? null)
    .query(`
      UPDATE dbo.sync_schedules SET
        enabled          = COALESCE(@enabled, enabled),
        interval_minutes = COALESCE(@intervalMinutes, interval_minutes),
        lookback_days    = COALESCE(@lookbackDays, lookback_days),
        updated_at       = SYSUTCDATETIME()
      WHERE source = @source
    `);
  return getSchedule(source);
}

export async function markRun(source: string, status: 'success' | 'failed' | 'skipped'): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('source', sql.NVarChar(40), source)
    .input('status', sql.NVarChar(20), status)
    .query(`
      UPDATE dbo.sync_schedules SET
        last_run_at = SYSUTCDATETIME(),
        last_status = @status,
        updated_at  = SYSUTCDATETIME()
      WHERE source = @source
    `);
}
