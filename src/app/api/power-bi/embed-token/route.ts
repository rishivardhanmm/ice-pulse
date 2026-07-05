import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isPowerBIConfigured } from '@/server/config/env';
import { getEmbedToken } from '@/server/services/powerbi.service';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  if (!isPowerBIConfigured()) {
    return jsonError('Power BI credentials are not configured.', 503);
  }

  let body: { workspaceId?: string; reportId?: string } = {};
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  if (!body.workspaceId || !body.reportId) {
    return jsonError('workspaceId and reportId are required.', 400);
  }

  try {
    const embedToken = await getEmbedToken(body.workspaceId, body.reportId);
    return jsonOk(embedToken);
  } catch (err) {
    return jsonError(toErrorMessage(err), 502);
  }
}
