import { getPool, sql } from '../pool';
import { toIso } from '../utils';

export interface UserRow {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'internal' | 'client';
  clientId: number | null;
  clientSlug: string | null;
  clientName: string | null;
  teamRoleId: number | null;
  teamRoleName: string | null;
  canApprove: boolean;
  isActive: boolean;
  createdAt: string;
}

function mapUser(r: Record<string, unknown>): UserRow {
  return {
    id: Number(r.id),
    email: String(r.email),
    passwordHash: String(r.password_hash),
    name: String(r.name),
    role: String(r.role) as UserRow['role'],
    clientId: r.client_id != null ? Number(r.client_id) : null,
    clientSlug: (r.client_slug as string) ?? null,
    clientName: (r.client_name as string) ?? null,
    teamRoleId: r.team_role_id != null ? Number(r.team_role_id) : null,
    teamRoleName: (r.team_role_name as string) ?? null,
    canApprove: Boolean(r.can_approve),
    isActive: Boolean(r.is_active),
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  };
}

const SELECT =
  `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.client_id,
          c.slug AS client_slug, c.name AS client_name,
          u.team_role_id, tr.name AS team_role_name, ISNULL(tr.can_approve, 0) AS can_approve,
          u.is_active, u.created_at
   FROM dbo.users u
   LEFT JOIN dbo.clients c ON c.id = u.client_id
   LEFT JOIN dbo.team_roles tr ON tr.id = u.team_role_id`;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('email', sql.NVarChar(254), email.toLowerCase().trim())
    .query(`${SELECT} WHERE u.email = @email`);
  return res.recordset[0] ? mapUser(res.recordset[0]) : null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`${SELECT} WHERE u.id = @id`);
  return res.recordset[0] ? mapUser(res.recordset[0]) : null;
}

export async function listUsers(): Promise<UserRow[]> {
  const pool = await getPool();
  const res = await pool.request().query(`${SELECT} ORDER BY u.role, u.name`);
  return res.recordset.map(mapUser);
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'internal' | 'client';
  clientId?: number | null;
  teamRoleId?: number | null;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('email', sql.NVarChar(254), input.email.toLowerCase().trim())
    .input('password_hash', sql.NVarChar(512), input.passwordHash)
    .input('name', sql.NVarChar(200), input.name)
    .input('role', sql.NVarChar(20), input.role)
    .input('client_id', sql.Int, input.clientId ?? null)
    .input('team_role_id', sql.Int, input.teamRoleId ?? null)
    .query(
      `INSERT INTO dbo.users (email, password_hash, name, role, client_id, team_role_id)
       OUTPUT inserted.id
       VALUES (@email, @password_hash, @name, @role, @client_id, @team_role_id)`,
    );
  const id = Number(res.recordset[0].id);
  return (await findUserById(id))!;
}

export async function setUserTeamRole(id: number, teamRoleId: number | null): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('teamRoleId', sql.Int, teamRoleId)
    .query(`UPDATE dbo.users SET team_role_id = @teamRoleId, updated_at = SYSUTCDATETIME() WHERE id = @id`);
}

export async function updateUserPassword(id: number, passwordHash: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('hash', sql.NVarChar(512), passwordHash)
    .query(`UPDATE dbo.users SET password_hash = @hash, updated_at = SYSUTCDATETIME() WHERE id = @id`);
}

export interface ApproverRow {
  id: number;
  name: string;
  email: string;
}

/** Active users with approval power (admins, or internal staff whose team role grants it). */
export async function listApprovers(excludeUserId?: number): Promise<ApproverRow[]> {
  const pool = await getPool();
  const req = pool.request();
  let where = `u.is_active = 1 AND (u.role = 'admin' OR ISNULL(tr.can_approve, 0) = 1)`;
  if (excludeUserId !== undefined) {
    req.input('excludeUserId', sql.Int, excludeUserId);
    where += ' AND u.id != @excludeUserId';
  }
  const res = await req.query(`
    SELECT u.id, u.name, u.email
    FROM dbo.users u
    LEFT JOIN dbo.team_roles tr ON tr.id = u.team_role_id
    WHERE ${where}
    ORDER BY u.name
  `);
  return res.recordset.map((r) => ({ id: Number(r.id), name: String(r.name), email: String(r.email) }));
}

export async function setUserActive(id: number, isActive: boolean): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('active', sql.Bit, isActive ? 1 : 0)
    .query(`UPDATE dbo.users SET is_active = @active, updated_at = SYSUTCDATETIME() WHERE id = @id`);
}
