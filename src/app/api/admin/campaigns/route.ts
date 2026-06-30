import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import {
  listCampaignsWithAssignment,
  assignCampaignToClient,
} from '@/server/db/repositories/campaigns.repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  const campaigns = await listCampaignsWithAssignment();
  return jsonOk(campaigns);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const body = await req.json().catch(() => ({})) as {
    campaignId?: number;
    clientId?: number | null;
  };

  if (typeof body.campaignId !== 'number') return jsonError('campaignId required', 400);

  await assignCampaignToClient(
    body.campaignId,
    typeof body.clientId === 'number' ? body.clientId : null,
  );

  return jsonOk({ ok: true });
}
