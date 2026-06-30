import { getPool, sql } from '../pool';
import { toIso } from '../utils';

export interface TeamRoleRow {
  id: number;
  name: string;
  canApprove: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): TeamRoleRow {
  return {
    id: Number(r.id),
    name: String(r.name),
    canApprove: Boolean(r.can_approve),
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(r.updated_at) ?? new Date().toISOString(),
  };
}

export async function listTeamRoles(): Promise<TeamRoleRow[]> {
  const pool = await getPool();
  const res = await pool.request().query(
    `SELECT id, name, can_approve, created_at, updated_at FROM dbo.team_roles ORDER BY name`,
  );
  return res.recordset.map(mapRow);
}

export async function getTeamRoleById(id: number): Promise<TeamRoleRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT id, name, can_approve, created_at, updated_at FROM dbo.team_roles WHERE id = @id`);
  return res.recordset[0] ? mapRow(res.recordset[0]) : null;
}

export async function createTeamRole(input: { name: string; canApprove: boolean }): Promise<TeamRoleRow> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('name', sql.NVarChar(100), input.name)
    .input('canApprove', sql.Bit, input.canApprove)
    .query(
      `INSERT INTO dbo.team_roles (name, can_approve)
       OUTPUT inserted.id, inserted.name, inserted.can_approve, inserted.created_at, inserted.updated_at
       VALUES (@name, @canApprove)`,
    );
  return mapRow(res.recordset[0]);
}

export async function updateTeamRole(
  id: number,
  input: { name?: string; canApprove?: boolean },
): Promise<TeamRoleRow | null> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(100), input.name ?? null)
    .input('canApprove', sql.Bit, input.canApprove === undefined ? null : input.canApprove)
    .query(`
      UPDATE dbo.team_roles SET
        name        = COALESCE(@name, name),
        can_approve = COALESCE(@canApprove, can_approve),
        updated_at  = SYSUTCDATETIME()
      WHERE id = @id
    `);
  return getTeamRoleById(id);
}
