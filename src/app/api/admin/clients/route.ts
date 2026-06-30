import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { listClients } from '@/server/db/repositories/clients.repo';
import { getPool, sql } from '@/server/db/pool';

export const dynamic = 'force-dynamic';

function requireAdmin(role: string | undefined) {
  return role === 'admin' || role === 'internal';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !requireAdmin(session.user.role)) return jsonError('Forbidden', 403);
  const clients = await listClients();
  return jsonOk(clients);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !requireAdmin(session.user.role)) return jsonError('Forbidden', 403);

  const body = await req.json().catch(() => ({})) as { name?: string; description?: string };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return jsonError('Client name is required.', 400);

  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  const pool = await getPool();

  // Find a unique slug by appending -2, -3, etc. if needed
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const existing = await pool
      .request()
      .input('slug', sql.NVarChar(120), slug)
      .query(`SELECT 1 AS found FROM dbo.clients WHERE slug = @slug`);
    if (existing.recordset.length === 0) break;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const res = await pool
    .request()
    .input('name', sql.NVarChar(200), name)
    .input('slug', sql.NVarChar(120), slug)
    .input('description', sql.NVarChar(1000), body.description?.trim() ?? null)
    .query(
      `INSERT INTO dbo.clients (name, slug, description, status)
       OUTPUT inserted.id, inserted.slug, inserted.name
       VALUES (@name, @slug, @description, 'active')`,
    );

  return jsonOk(res.recordset[0]);
}
