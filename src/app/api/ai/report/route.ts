import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateReport } from '@/ai/ai.service';
import { getCampaignIdsForClient } from '@/server/db/repositories/campaigns.repo';
import { getMetaCampaignIdsForClient } from '@/server/db/repositories/meta-metrics.repo';
import { getClientById } from '@/server/db/repositories/clients.repo';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReportBody {
  from?: string;
  to?: string;
  clientId?: number;
  campaignIds?: number[];
  metaCampaignIds?: number[];
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError('Unauthenticated', 401);
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ReportBody;
    const def = defaultRange(90);
    const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
    const to = isValidDateStr(body.to) ? (body.to as string) : def.to;
    const range = from > to ? { from: to, to: from } : { from, to };

    // Scoping options are staff-only; client users always get the full report page scope-free.
    let campaignIds: number[] | undefined;
    let metaCampaignIds: number[] | undefined;
    let clientName: string | null = null;
    const isStaff = session.user.role === 'admin' || session.user.role === 'internal';

    if (isStaff && typeof body.clientId === 'number' && Number.isFinite(body.clientId)) {
      const [ids, metaIds, client] = await Promise.all([
        getCampaignIdsForClient(body.clientId),
        getMetaCampaignIdsForClient(body.clientId),
        getClientById(body.clientId).catch(() => null),
      ]);
      if (ids.length === 0 && metaIds.length === 0) {
        return jsonError('This client has no campaigns assigned yet — assign campaigns in Client Management first.', 400);
      }
      campaignIds = ids;
      metaCampaignIds = metaIds;
      clientName = client?.name ?? null;
    } else if (
      isStaff &&
      ((Array.isArray(body.campaignIds) && body.campaignIds.length > 0) ||
        (Array.isArray(body.metaCampaignIds) && body.metaCampaignIds.length > 0))
    ) {
      // Ad-hoc hand-picked campaigns, channel-split by the caller — each id list
      // only ever means ids in ITS OWN channel's table. Missing = "none of that
      // channel selected", not "unscoped", so unrelated global data never leaks in.
      campaignIds = Array.isArray(body.campaignIds)
        ? body.campaignIds.map(Number).filter(Number.isFinite)
        : [];
      metaCampaignIds = Array.isArray(body.metaCampaignIds)
        ? body.metaCampaignIds.map(Number).filter(Number.isFinite)
        : [];
    }

    const data = await generateReport(range.from, range.to, { campaignIds, metaCampaignIds, clientName });
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
