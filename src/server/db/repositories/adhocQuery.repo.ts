import { getPool } from '../pool';
import { MAX_RESULT_ROWS } from '../../../ai/sql-schema';

export interface AdhocResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
}

function serializeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return Number(v);
  return v;
}

function serializeRow(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) out[k] = serializeValue(v);
  return out;
}

/**
 * Executes a validated read-only SELECT and ALWAYS rolls back, so even a write
 * that somehow slipped past the guard cannot persist (DDL/DML are transactional
 * in SQL Server). Row-capped. Never pass unvalidated SQL — see sql-guard.ts.
 */
export async function runReadOnlyQuery(
  sqlText: string,
  maxRows = MAX_RESULT_ROWS,
): Promise<AdhocResult> {
  const pool = await getPool();
  const tx = pool.transaction();
  await tx.begin();
  try {
    const result = await tx.request().query(sqlText);
    const recordset = result.recordset ?? [];
    const metaColumns = result.recordset?.columns ? Object.keys(result.recordset.columns) : [];
    const rows = recordset.slice(0, maxRows).map((r) => serializeRow(r as Record<string, unknown>));
    return {
      columns: metaColumns.length ? metaColumns : rows.length ? Object.keys(rows[0]) : [],
      rows,
      rowCount: recordset.length,
      truncated: recordset.length > maxRows,
    };
  } finally {
    await tx.rollback().catch(() => undefined);
  }
}
