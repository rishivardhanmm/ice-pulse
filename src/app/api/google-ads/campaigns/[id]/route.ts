import { getCampaignDetail } from '@/server/services/dashboard.service';
import { jsonOk, jsonError, parseDateRange } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonError('Invalid campaign id', 400);
    }
    const { from, to } = parseDateRange(new URL(req.url).searchParams);
    const data = await getCampaignDetail(id, from, to);
    if (!data) return jsonError('Campaign not found', 404);
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
