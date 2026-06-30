import { getPool, sql } from '../pool';
import { toIso } from '../utils';
import type { ClientDTO } from '../../../lib/types';

function mapClient(r: Record<string, unknown>): ClientDTO {
  return {
    id: Number(r.id),
    name: String(r.name),
    slug: String(r.slug),
    description: (r.description as string) ?? null,
    status: String(r.status),
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(r.updated_at) ?? new Date().toISOString(),
  };
}

export async function listClients(): Promise<ClientDTO[]> {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT id, name, slug, description, status, created_at, updated_at
     FROM dbo.clients ORDER BY id`,
  );
  return result.recordset.map(mapClient);
}

/**
 * Returns the default internal client id, preferring the seeded 'ice-internal'
 * client. Creates one if the table is empty (e.g. seeds were not run), so the
 * sync works out of the box.
 */
export async function getDefaultClientId(): Promise<number> {
  const pool = await getPool();
  const existing = await pool.request().query(
    `SELECT TOP 1 id FROM dbo.clients
     ORDER BY CASE WHEN slug = 'ice-internal' THEN 0 ELSE 1 END, id`,
  );
  if (existing.recordset.length > 0) return Number(existing.recordset[0].id);

  const inserted = await pool
    .request()
    .input('name', sql.NVarChar(200), 'ICE Creates (Internal)')
    .input('slug', sql.NVarChar(120), 'ice-internal')
    .query(
      `INSERT INTO dbo.clients (name, slug, status)
       OUTPUT inserted.id AS id VALUES (@name, @slug, 'active')`,
    );
  return Number(inserted.recordset[0].id);
}
