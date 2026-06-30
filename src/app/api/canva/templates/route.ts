import { getActiveConnection, listTemplates } from '@/server/db/repositories/canva.repo';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** List synced Canva templates (optionally filtered by ?search). Connection-gated. */
export async function GET(req: Request) {
  try {
    const conn = await getActiveConnection();
    if (!conn) return jsonOk({ templates: [] });
    const search = new URL(req.url).searchParams.get('search') ?? undefined;
    const templates = await listTemplates(conn.id, search);
    return jsonOk({ templates });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
