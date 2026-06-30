import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { getPool, sql } from '@/server/db/pool';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return jsonError('Invalid client id', 400);

  const pool = await getPool();

  // Refuse to delete the ICE internal client
  const check = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT slug FROM dbo.clients WHERE id = @id`);

  if (!check.recordset[0]) return jsonError('Client not found', 404);
  if (check.recordset[0].slug === 'ice-internal') {
    return jsonError('The ICE Creates internal client cannot be deleted.', 400);
  }

  // 1. Unassign all campaigns for this client
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`UPDATE dbo.google_ads_campaigns SET client_id = NULL WHERE client_id = @id`);

  // 2. Delete users belonging to this client
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM dbo.users WHERE client_id = @id`);

  // 3. Delete Canva connections if the table exists
  try {
    await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        IF OBJECT_ID('dbo.canva_connections') IS NOT NULL
          DELETE FROM dbo.canva_connections WHERE client_id = @id
      `);
  } catch {
    // Canva tables optional
  }

  // 4. Delete the client
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM dbo.clients WHERE id = @id`);

  return jsonOk({ ok: true });
}
