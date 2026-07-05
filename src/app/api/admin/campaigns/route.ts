import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import {
  listCampaignsWithAssignment,
  assignCampaignToClient,
} from '@/server/db/repositories/campaigns.repo';
import {
  listMetaCampaignsWithAssignment,
  assignMetaCampaignToClient,
} from '@/server/db/repositories/meta-metrics.repo';

export const dynamic = 'force-dynamic';

/**
 * Unified campaign list for the Client Management assignment UI — Google and
 * Meta campaigns merged into one array, each tagged with `channel` so staff
 * can assign either kind to a client from the same screen.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  const [google, meta] = await Promise.all([
    listCampaignsWithAssignment(),
    listMetaCampaignsWithAssignment(),
  ]);
  const campaigns = [
    ...google.map((c) => ({ ...c, channel: 'google' as const })),
    ...meta.map((c) => ({
      id: c.id,
      googleCampaignId: c.metaCampaignId, // kept for the shared frontend shape
      campaignName: c.campaignName,
      campaignStatus: c.campaignStatus,
      clientId: c.clientId,
      clientName: c.clientName,
      clientSlug: c.clientSlug,
      channel: 'meta' as const,
    })),
  ];
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
    channel?: 'google' | 'meta';
  };

  if (typeof body.campaignId !== 'number') return jsonError('campaignId required', 400);
  const clientId = typeof body.clientId === 'number' ? body.clientId : null;

  if (body.channel === 'meta') {
    await assignMetaCampaignToClient(body.campaignId, clientId);
  } else {
    await assignCampaignToClient(body.campaignId, clientId);
  }

  return jsonOk({ ok: true });
}
