import { listClients } from '@/server/db/repositories/clients.repo';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clients = await listClients();
    return jsonOk({ clients });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
