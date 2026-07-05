import { getPool, sql } from '../pool';

export interface ClientBudgetRow {
  clientId: number;
  pctUsed: number;
  /** Monthly budget amount in the account currency; null when staff haven't set one. */
  monthlyBudget: number | null;
  /** Monthly conversion target; null when no goal agreed. */
  monthlyConversionGoal: number | null;
  notes: string | null;
  updatedAt: string;
}

/** Get the budget for a single client, or null if not set. */
export async function getClientBudget(clientId: number): Promise<ClientBudgetRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('clientId', sql.Int, clientId)
    .query(`SELECT client_id, pct_used, monthly_budget, monthly_conversion_goal, notes, updated_at
            FROM dbo.client_budget WHERE client_id = @clientId`);
  const r = res.recordset[0];
  if (!r) return null;
  return {
    clientId: Number(r.client_id),
    pctUsed: Number(r.pct_used),
    monthlyBudget: r.monthly_budget != null ? Number(r.monthly_budget) : null,
    monthlyConversionGoal:
      r.monthly_conversion_goal != null ? Number(r.monthly_conversion_goal) : null,
    notes: (r.notes as string) ?? null,
    updatedAt: new Date(r.updated_at as Date).toISOString(),
  };
}

/** Set (upsert) the budget for a client. Null amounts clear the field. */
export async function upsertClientBudget(
  clientId: number,
  pctUsed: number,
  notes: string | null,
  setBy: number | null,
  monthlyBudget?: number | null,
  monthlyConversionGoal?: number | null,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('clientId', sql.Int, clientId)
    .input('pctUsed', sql.Int, pctUsed)
    .input('monthlyBudget', sql.Decimal(18, 2), monthlyBudget ?? null)
    .input('conversionGoal', sql.Decimal(18, 2), monthlyConversionGoal ?? null)
    .input('notes', sql.NVarChar(500), notes)
    .input('setBy', sql.Int, setBy)
    .query(`
      MERGE dbo.client_budget AS t
      USING (SELECT @clientId AS client_id) AS s ON t.client_id = s.client_id
      WHEN MATCHED THEN UPDATE SET
        pct_used = @pctUsed, monthly_budget = @monthlyBudget,
        monthly_conversion_goal = @conversionGoal, notes = @notes, set_by = @setBy,
        updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (client_id, pct_used, monthly_budget, monthly_conversion_goal, notes, set_by)
        VALUES (@clientId, @pctUsed, @monthlyBudget, @conversionGoal, @notes, @setBy);
    `);
}
