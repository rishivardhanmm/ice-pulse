import { getPool, sql } from '../pool';

export interface ClientBudgetRow {
  clientId: number;
  pctUsed: number;
  notes: string | null;
  updatedAt: string;
}

/** Get the budget % for a single client, or null if not set. */
export async function getClientBudget(clientId: number): Promise<ClientBudgetRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('clientId', sql.Int, clientId)
    .query(`SELECT client_id, pct_used, notes, updated_at
            FROM dbo.client_budget WHERE client_id = @clientId`);
  const r = res.recordset[0];
  if (!r) return null;
  return {
    clientId: Number(r.client_id),
    pctUsed: Number(r.pct_used),
    notes: (r.notes as string) ?? null,
    updatedAt: new Date(r.updated_at as Date).toISOString(),
  };
}

/** Set (upsert) the budget % for a client. */
export async function upsertClientBudget(
  clientId: number,
  pctUsed: number,
  notes: string | null,
  setBy: number | null,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('clientId', sql.Int, clientId)
    .input('pctUsed', sql.Int, pctUsed)
    .input('notes', sql.NVarChar(500), notes)
    .input('setBy', sql.Int, setBy)
    .query(`
      MERGE dbo.client_budget AS t
      USING (SELECT @clientId AS client_id) AS s ON t.client_id = s.client_id
      WHEN MATCHED THEN UPDATE SET
        pct_used = @pctUsed, notes = @notes, set_by = @setBy,
        updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (client_id, pct_used, notes, set_by)
        VALUES (@clientId, @pctUsed, @notes, @setBy);
    `);
}
